/*
|--------------------------------------------------------------------------
| Http Exception Handler
|--------------------------------------------------------------------------
|
| AdonisJs will forward all exceptions occurred during an HTTP request to
| the following class. You can learn more about exception handling by
| reading docs.
|
| The exception handler extends a base `HttpExceptionHandler` which is not
| mandatory, however it can do lot of heavy lifting to handle the errors
| properly.
|
*/

import Logger from '@ioc:Adonis/Core/Logger'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import HttpExceptionHandler from '@ioc:Adonis/Core/HttpExceptionHandler'
import logger from 'App/Utils/Logger'

export default class ExceptionHandler extends HttpExceptionHandler {
  constructor() {
    super(Logger)
  }

  public async handle(error: any, ctx: HttpContextContract) {
    /**
     * Self handle the validation exception
     */
    if (error.code === 'E_UNAUTHORIZED_ACCESS') {
      return ctx.response.status(401).send({
        sucesso: false,
        mensagem: 'Sessão expirada',
        resultados: {},
        erro_validacao: false,
      })
    }

    if (error.code === 'E_INVALID_AUTH_PASSWORD') {
      return ctx.response.status(400).send({
        sucesso: false,
        mensagem: 'Usuário ou senha incorretos',
        resultados: {},
        erro_validacao: false,
      })
    }

    if (error.code === 'E_VALIDATION_FAILURE') {
      return ctx.response.status(422).send(error.messages)
    }

    if (error.message) logger.error(error.message)

    if (error.stack) logger.error(error.stack)

    logger.error('ERRO:' + error + ' MENSAGENS: ' + error.messages)

    return super.handle(error, ctx)
  }
}
