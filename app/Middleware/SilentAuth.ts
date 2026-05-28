import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { AUTH_COOKIE_NAME } from 'App/Utils/AuthCookie'

/**
 * Silent auth middleware can be used as a global middleware to silent check
 * if the user is logged-in or not.
 *
 * The request continues as usual, even when the user is not logged-in.
 */
export default class SilentAuthMiddleware {
  private bindApiTokenFromCookie(ctx: HttpContextContract) {
    const signedCookieToken = String(ctx.request.cookie(AUTH_COOKIE_NAME) || '').trim()
    const plainCookieToken = String(ctx.request.plainCookie(AUTH_COOKIE_NAME) || '').trim()
    const cookieToken = signedCookieToken || plainCookieToken
    if (!cookieToken) return

    const expectedHeader = `Bearer ${cookieToken}`
    const authHeader = String(ctx.request.header('authorization') || '').trim()

    // Mantém header explícito quando já é o esperado. Caso contrário, injeta do cookie.
    if (!authHeader || authHeader === expectedHeader) {
      ;(ctx.request.request.headers as Record<string, string>)['authorization'] = expectedHeader
    }
  }

  /**
   * Handle request
   */
  public async handle(ctx: HttpContextContract, next: () => Promise<void>) {
    this.bindApiTokenFromCookie(ctx)

    /**
     * Check if user is logged-in or not. If yes, then `ctx.auth.user` will be
     * set to the instance of the currently logged in user.
     */
    await ctx.auth.check()
    await next()
  }
}
