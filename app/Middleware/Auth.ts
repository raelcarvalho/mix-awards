import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { AuthenticationException } from '@adonisjs/auth/build/standalone'
import Env from '@ioc:Adonis/Core/Env'
import { AUTH_COOKIE_NAME } from 'App/Utils/AuthCookie'

/**
 * Auth middleware is meant to restrict un-authenticated access to a given route
 * or a group of routes.
 *
 * You must register this middleware inside `start/kernel.ts` file under the list
 * of named middleware.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to when request is Unauthorized
   */
  protected redirectTo = '/login'

  /**
   * Authenticates the current HTTP request against a custom set of defined
   * guards.
   *
   * The authentication loop stops as soon as the user is authenticated using any
   * of the mentioned guards and that guard will be used by the rest of the code
   * during the current request.
   */
  protected async authenticate(auth: HttpContextContract['auth'], guards: any[]) {
    /**
     * Hold reference to the guard last attempted within the for loop. We pass
     * the reference of the guard to the "AuthenticationException", so that
     * it can decide the correct response behavior based upon the guard
     * driver
     */
    let guardLastAttempted: string | undefined

    for (let guard of guards) {
      guardLastAttempted = guard

      if (await auth.use(guard).check()) {
        /**
         * Instruct auth to use the given guard as the default guard for
         * the rest of the request, since the user authenticated
         * succeeded here
         */
        auth.defaultGuard = guard
        return true
      }
    }

    /**
     * Unable to authenticate using any guard
     */
    throw new AuthenticationException(
      'Unauthorized access',
      'E_UNAUTHORIZED_ACCESS',
      guardLastAttempted,
      this.redirectTo
    )
  }

  private shouldAllowLegacyBearerHeader() {
    const raw = String(Env.get('ALLOW_LEGACY_BEARER_HEADER') || '')
      .trim()
      .toLowerCase()
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
  }

  private bindApiTokenFromCookie(ctx: HttpContextContract, guards: string[]) {
    if (!guards.includes('api')) return

    // Tenta primeiro cookie assinado (padrão). Fallback para plain em ambientes legados.
    const signedCookieToken = String(ctx.request.cookie(AUTH_COOKIE_NAME) || '').trim()
    const plainCookieToken = String(ctx.request.plainCookie(AUTH_COOKIE_NAME) || '').trim()
    const cookieToken = signedCookieToken || plainCookieToken
    const authHeader = String(ctx.request.header('authorization') || '').trim()
    const allowLegacyHeader = this.shouldAllowLegacyBearerHeader()

    if (!cookieToken) {
      if (allowLegacyHeader && /^Bearer\s+\S+$/i.test(authHeader)) return
      throw new AuthenticationException(
        'Unauthorized access',
        'E_UNAUTHORIZED_ACCESS',
        'api',
        this.redirectTo
      )
    }

    const expectedHeader = `Bearer ${cookieToken}`
    if (authHeader && authHeader !== expectedHeader) {
      throw new AuthenticationException(
        'Unauthorized access',
        'E_UNAUTHORIZED_ACCESS',
        'api',
        this.redirectTo
      )
    }

    ;(ctx.request.request.headers as Record<string, string>)['authorization'] = expectedHeader
  }

  /**
   * Handle request
   */
  public async handle(
    ctx: HttpContextContract,
    next: () => Promise<void>,
    customGuards: string[]
  ) {
    const { auth } = ctx
    /**
     * Uses the user defined guards or the default guard mentioned in
     * the config file
     */
    const guards = customGuards.length ? customGuards : [auth.name]
    this.bindApiTokenFromCookie(ctx, guards)
    await this.authenticate(auth, guards)
    await next()
  }
}
