import UsuarioAdmToken from 'App/Models/UsuarioAdmToken'
import Usuario from 'App/Models/UsuarioAdm'
import UsuarioAdm from 'App/Models/UsuarioAdm'

const axios = require('axios').default

class AutenticacaoUsuario {
  public async removerTokens(id_usuario: number) {
    const retorno = await UsuarioAdmToken.query().where('user_id', id_usuario).delete()

    return retorno
  }

  public async validarUsuarioAtivo(
    campoChave: string,
    valor: string
  ): Promise<UsuarioAdm | string> {
    const usuario = await UsuarioAdm.query().where(campoChave, valor).first()

    if (!usuario) {
      return 'Usuário ou senha inválidos.'
    }

    if (usuario.dt_exclusao !== null) {
      return 'Usuário inativo. Acesso negado.'
    }

    return usuario
  }

  public async normalizeName(input: string) {
  return input
    .normalize('NFD')                // separa acentos
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, ' ')            // colapsa espaços
    .trim()
    .toUpperCase();
}
}

const logout = new AutenticacaoUsuario()
export default logout
