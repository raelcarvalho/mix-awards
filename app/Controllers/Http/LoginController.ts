import Hash from "@ioc:Adonis/Core/Hash";
import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Jogadores from "App/Models/Jogadores";
import UsuarioAdm from "App/Models/UsuarioAdm";
import ApiBrevo from "App/Service/ApiBrevo";
import CustomResponse from "App/Utils/CustomResponse";
import Validators from "App/Validators/LoginValidators";
import Env from "@ioc:Adonis/Core/Env";

export default class LoginController {
  protected validators: Validators;
  protected customResponse: CustomResponse;

  constructor() {
    this.validators = new Validators();
    this.customResponse = new CustomResponse();
  }

  public async cadastrar({ response, request }: HttpContextContract) {
    try {
      const payload = await request.validate(this.validators.cadastro());

      const usuarioExistente = await UsuarioAdm.query()
        .where("email", "=", payload.email)
        .first();

      if (usuarioExistente) {
        return this.customResponse.erro(
          response,
          "Usuário já cadastrado.",
          {},
          400
        );
      }

      const usuario = await UsuarioAdm.create(payload);
      usuario.usuario_admin = false;
      await usuario.save();

      const normalized = (payload.nome_normalizado || payload.nome)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();

      let candidatos = await Jogadores.query()
        .whereNotNull("nome_normalizado")
        .where("nome_normalizado", normalized)
        .whereNull("usuario_adm_id")
        .limit(2);

      if (candidatos.length === 0) {
        const possiveis = await Jogadores.query()
          .whereILike("nome", payload.nome_normalizado || payload.nome)
          .whereNull("usuario_adm_id")
          .limit(5);

        candidatos = possiveis.filter((j) => {
          const jNorm = j.nome
            ? j.nome
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, " ")
                .trim()
                .toUpperCase()
            : "";
          return jNorm === normalized;
        });
      }

      let mensagemVinculo =
        "Nenhum jogador correspondente encontrado para vincular.";
      if (candidatos.length === 1) {
        candidatos[0].merge({ usuario_adm_id: usuario.id });
        await candidatos[0].save();
        mensagemVinculo = "Jogador vinculado com sucesso.";
      } else if (candidatos.length > 1) {
        mensagemVinculo =
          "Foram encontrados múltiplos jogadores com este nome. Vinculação pendente.";
      }

      return this.customResponse.sucesso(
        response,
        "Cadastro realizado com sucesso!",
        {
          usuario,
          vinculo: mensagemVinculo,
        }
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao cadastrar usuario.",
        error,
        500
      );
    }
  }

  public async login({ response, request, auth }: HttpContextContract) {
    console.log("iniciando login");
    const payload = await request.validate(this.validators.login());

    try {
      const usuario = await UsuarioAdm.query()
        .where("email", payload.email)
        .first();

      if (!usuario) {
        return this.customResponse.erro(
          response,
          "Não foi possível encontrar o cliente solicitado!",
          {},
          401
        );
      }

      const senhaCorreta = await Hash.verify(usuario.password, payload.senha);

      if (!senhaCorreta) {
        return this.customResponse.erro(response, "Senha incorreta", {}, 401);
      }

      const jogador = await Jogadores.query()
        .where("nome", usuario.nome_normalizado)
        .whereNull("usuario_adm_id")
        .first();

      if (jogador) {
        jogador.usuario_adm_id = usuario.id;
        jogador.nome_normalizado = usuario.nome_normalizado;
        await jogador.save();
        console.log(
          `Jogador ${jogador.nome} vinculado ao usuário ${usuario.nome}`
        );
      }

      const token = await auth
        .use("api")
        .attempt(payload.email, payload.senha, {
          expiresIn: "10 days",
        });

      const usuarioDdb = await UsuarioAdm.query()
        .where("email", payload.email)
        .firstOrFail();

      const isAdmin = usuarioDdb.usuario_admin === true;

      console.log("login funcionou", usuarioDdb);

      return this.customResponse.sucesso(
        response,
        "Login realizado com sucesso!",
        {
          ...token.toJSON(),
          usuario: usuarioDdb,
          isAdmin,
        }
      );
    } catch (error) {
      console.error("Erro ao efetuar login:", error);
      return this.customResponse.erro(
        response,
        "Houve um erro ao efetuar o login!",
        error,
        500
      );
    }
  }

  public async recuperarSenha({ request, response }: HttpContextContract) {
    try {
      const payload = await request.validate(this.validators.recuperarSenha());

      const usuario = await UsuarioAdm.query()
        .where("email", (payload.email || "").toLowerCase())
        .first();

      if (!usuario) {
        return this.customResponse.erro(
          response,
          "Usuário não encontrado.",
          {},
          404
        );
      }

      usuario.password = "123123";
      usuario.alterar_senha = 1;
      await usuario.save();

      const loginUrl = `${Env.get("APP_URL")}/login`;
      const alterarSenhaUrl = `${Env.get("APP_URL")}/alterar-senha`;

      const subject = "Sua senha foi redefinida";
      const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5">
        <p>Olá <strong>${usuario.nome}</strong>,</p>
        <p>Sua senha foi temporariamente redefinida para: <strong>123123</strong>.</p>
        <p>Acesse o <a href="${loginUrl}">site do MIX AWARDS</a>, faça login e depois vá em <em>Alterar Senha</em> para definir a sua senha definitiva.</p>
        <p>Atalho direto: <a href="${alterarSenhaUrl}">${alterarSenhaUrl}</a></p>
        <hr/>
        <p style="font-size:12px;color:#666">Se você não solicitou essa alteração, contate o suporte imediatamente.</p>
      </div>
    `;
      const text = `Olá ${usuario.nome},
        Sua senha foi temporariamente redefinida para: 123123.
        Acesse ${loginUrl} e, após logar, altere sua senha em ${alterarSenhaUrl}.
        Se não foi você, contate o suporte.`;

      await ApiBrevo.send({
        toEmail: usuario.email,
        toName: usuario.nome,
        subject,
        html,
        text,
      });

      return this.customResponse.sucesso(
        response,
        "Senha redefinida e e-mail enviado com instruções.",
        { usuario_id: usuario.id }
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao recuperar senha.",
        error,
        500
      );
    }
  }

  public async alterarSenha({ request, response, auth }: HttpContextContract) {
    const user = await auth.authenticate();
    const payload = await request.validate(this.validators.alterarSenha());

    try {
      const usuarioAdm = await UsuarioAdm.findBy("id", user.id);

      if (!usuarioAdm || !usuarioAdm.id) {
        return this.customResponse.erro(
          response,
          "Usuario não encontrado!",
          {},
          404
        );
      }

      try {
        const senhaValida = await auth
          .use("api")
          .verifyCredentials(usuarioAdm.email, payload.senha_anterior);

        if (!senhaValida) {
          return this.customResponse.erro(
            response,
            "Senha anterior incorreta!",
            {},
            403
          );
        }
      } catch (error) {
        return this.customResponse.erro(
          response,
          "Senha anterior incorreta!",
          {},
          403
        );
      }

      usuarioAdm.alterar_senha = 0;
      usuarioAdm.password = payload.nova_senha;
      await usuarioAdm.save();

      const token = await auth
        .use("api")
        .attempt(usuarioAdm.email, payload.nova_senha, {
          expiresIn: "10 days",
        });

      return this.customResponse.sucesso(
        response,
        "Senha alterada com sucesso!",
        {
          ...token.toJSON(),
          usuario: usuarioAdm,
        }
      );
    } catch (error) {
      return this.customResponse.exception(
        response,
        "Houve um erro ao alterar a senha",
        error,
        500
      );
    }
  }

  public async me({ response, auth }: HttpContextContract) {
    try {
      const user = auth.user;
      if (!user) {
        return this.customResponse.erro(
          response,
          "Usuário não autenticado",
          {},
          401
        );
      }

      return this.customResponse.sucesso(response, "Usuário autenticado", user);
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao recuperar usuário",
        error,
        500
      );
    }
  }

  public async logout({ response, auth }: HttpContextContract) {
    try {
      // tenta revogar o token do guard 'api'
      try {
        await (auth as any).use("api").logout();
      } catch (e) {
        // fallback para logout genérico
        await auth.logout();
      }

      return this.customResponse.sucesso(
        response,
        "Logout realizado com sucesso",
        {}
      );
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao deslogar", error, 500);
    }
  }
}
