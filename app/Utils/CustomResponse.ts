import logger from './Logger'
import pako from 'pako'

export default class CustomResponse {
  public sucesso(
    response: any,
    mensagem: string,
    resultados: object | null = {},
    codigo_http = 200
  ) {
    response.status(codigo_http)
    return response.send({
      sucesso: true,
      mensagem,
      resultados,
    })
  }

  public erro(response: any, mensagem: string, erro: any, codigo_http = 500) {
    if (erro?.message?.includes('E_VALIDATION_FAILURE')) {
      codigo_http = 400
      response.status(400)
      return response.send({
        sucesso: false,
        mensagem,
        resultados: erro?.messages?.errors,
        erro_de_validacao: true,
      })
    }

    response.status(codigo_http)
    return response.send({
      sucesso: false,
      mensagem,
      resultados: erro,
      erro_de_validacao: false,
    })
  }

  public exception(response: any, mensagemCustomizada: string, erro: any, httpCode = 500) {
    if (mensagemCustomizada) logger.error(mensagemCustomizada)

    if (erro.message) logger.error(erro.message)

    if (erro.stack) logger.error(erro.stack)

    return response.status(httpCode).send({
      sucesso: false,
      mensagem: erro.message ? erro.message : 'Erro desconhecido',
      resultados: erro.stack ? erro.stack : erro.data ? erro.data : erro ? erro : 'Indisponivel',
      mensagem_codigo: mensagemCustomizada,
      erro_de_validacao: false,
    })
  }

  public async sucessoJsonGrande(
    response: any,
    mensagem: string,
    resultados: object | null,
    codigoHttp = 200
  ) {
    // Comprimir a resposta usando pako para gzip
    let resposta = {
      sucesso: true,
      mensagem,
      resultados,
    }

    const jsonData = JSON.stringify(resposta)
    const compressedData = pako.gzip(jsonData)

    // Definir o cabeçalho de resposta para gzip
    response.header('Content-Encoding', 'gzip')
    response.header('Content-Type', 'application/json')
    response.status(codigoHttp)
    return response.send(Buffer.from(compressedData)) // Enviar a resposta comprimida como Buffer
  }
}
