import Hash from "@ioc:Adonis/Core/Hash";
import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { randomBytes } from "crypto";
import Jogadores from "App/Models/Jogadores";
import UsuarioAdm from "App/Models/UsuarioAdm";
import ApiBrevo from "App/Service/ApiBrevo";
import { clearAuthCookie, setAuthCookie } from "App/Utils/AuthCookie";
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

  private normalizeName(raw: string) {
    return String(raw || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
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
      const normalized = this.normalizeName(payload.nome_normalizado || payload.nome);
      usuario.gc_nick = payload.nome_normalizado || null;
      usuario.gc_nick_normalizado = this.normalizeName(
        payload.nome_normalizado || ""
      ).toLowerCase();
      await usuario.save();

      let candidatos = await Jogadores.query()
        .where((q) =>
          q
            .where("gc_nick_normalizado", normalized.toLowerCase())
            .orWhere("nome_normalizado", normalized)
        )
        .whereNull("usuario_adm_id")
        .limit(2);

      if (candidatos.length === 0) {
        const possiveis = await Jogadores.query()
          .whereILike("nome", payload.nome_normalizado || payload.nome)
          .whereNull("usuario_adm_id")
          .limit(5);

        candidatos = possiveis.filter((j) => {
          const jNorm = this.normalizeName(j.nome || "");
          return jNorm === normalized;
        });
      }

      let mensagemVinculo =
        "Nenhum jogador correspondente encontrado para vincular.";
      if (candidatos.length === 1) {
        candidatos[0].merge({
          usuario_adm_id: usuario.id,
          gc_nick: candidatos[0].gc_nick || (payload.nome_normalizado || null),
          gc_nick_normalizado:
            candidatos[0].gc_nick_normalizado || normalized.toLowerCase(),
        });
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
    const payload = await request.validate(this.validators.login());

    try {
      const usuario = await UsuarioAdm.query()
        .where("email", payload.email)
        .first();

      if (!usuario) {
        return this.customResponse.erro(
          response,
          "Credenciais inválidas.",
          {},
          401
        );
      }

      const senhaCorreta = await Hash.verify(usuario.password, payload.senha);

      if (!senhaCorreta) {
        return this.customResponse.erro(response, "Credenciais inválidas.", {}, 401);
      }

      const chaveNome = this.normalizeName(
        usuario.gc_nick || usuario.nome_normalizado || ""
      );
      const chaveNomeLower = chaveNome.toLowerCase();
      let jogador =
        (usuario.gc_id
          ? await Jogadores.query()
              .where("gc_id", Number(usuario.gc_id))
              .where((q) =>
                q.whereNull("usuario_adm_id").orWhere("usuario_adm_id", usuario.id)
              )
              .first()
          : null) ||
        (usuario.steam_id
          ? await Jogadores.query()
              .where("steam_id", String(usuario.steam_id))
              .where((q) =>
                q.whereNull("usuario_adm_id").orWhere("usuario_adm_id", usuario.id)
              )
              .first()
          : null) ||
        (chaveNome
          ? await Jogadores.query()
              .where((q) =>
                q
                  .where("gc_nick_normalizado", chaveNomeLower)
                  .orWhere("nome_normalizado", chaveNome)
              )
              .whereNull("usuario_adm_id")
              .first()
          : null);

      if (jogador) {
        jogador.usuario_adm_id = usuario.id;
        if (!jogador.nome_normalizado && chaveNome) jogador.nome_normalizado = chaveNome;
        if (!jogador.gc_nick && usuario.gc_nick) jogador.gc_nick = usuario.gc_nick;
        if (!jogador.gc_nick_normalizado && chaveNomeLower) {
          jogador.gc_nick_normalizado = chaveNomeLower;
        }
        if (!jogador.gc_id && usuario.gc_id) jogador.gc_id = Number(usuario.gc_id);
        if (!jogador.steam_id && usuario.steam_id) {
          jogador.steam_id = String(usuario.steam_id);
        }
        await jogador.save();
        console.log(
          `Jogador ${jogador.nome} vinculado ao usuário ${usuario.nome}`
        );
      }

      const token = await auth.use("api").attempt(payload.email, payload.senha, {
        expiresIn: "10 days",
      });
      const tokenJson =
        typeof (token as any).toJSON === "function"
          ? (token as any).toJSON()
          : (token as any);
      const tokenValue = String(tokenJson?.token || (token as any)?.token || "");
      if (tokenValue) {
        setAuthCookie(response, tokenValue);
      }

      const usuarioDdb = await UsuarioAdm.query()
        .where("email", payload.email)
        .firstOrFail();

      const isAdmin = usuarioDdb.usuario_admin === true;

      return this.customResponse.sucesso(
        response,
        "Login realizado com sucesso!",
        {
          usuario: usuarioDdb,
          isAdmin,
          auth_mode: "cookie",
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

      const senhaTemporaria = randomBytes(6).toString("hex");
      usuario.password = senhaTemporaria;
      usuario.alterar_senha = 1;
      await usuario.save();

      const loginUrl = `${Env.get("APP_URL")}/login`;
      const alterarSenhaUrl = `${Env.get("APP_URL")}/alterar-senha`;

      const subject = "Sua senha foi redefinida";
      const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5">
        <p>Olá <strong>${usuario.nome}</strong>,</p>
        <p>Sua senha foi temporariamente redefinida para: <strong>${senhaTemporaria}</strong>.</p>
        <p>Acesse o <a href="${loginUrl}">site do MIX AWARDS</a>, faça login e depois vá em <em>Alterar Senha</em> para definir a sua senha definitiva.</p>
        <p>Atalho direto: <a href="${alterarSenhaUrl}">${alterarSenhaUrl}</a></p>
        <hr/>
        <p style="font-size:12px;color:#666">Se você não solicitou essa alteração, contate o suporte imediatamente.</p>
      </div>
    `;
      const text = `Olá ${usuario.nome},
        Sua senha foi temporariamente redefinida para: ${senhaTemporaria}.
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

      const token = await auth.use("api").attempt(usuarioAdm.email, payload.nova_senha, {
        expiresIn: "10 days",
      });
      const tokenJson =
        typeof (token as any).toJSON === "function"
          ? (token as any).toJSON()
          : (token as any);
      const tokenValue = String(tokenJson?.token || (token as any)?.token || "");
      if (tokenValue) {
        setAuthCookie(response, tokenValue);
      }

      return this.customResponse.sucesso(
        response,
        "Senha alterada com sucesso!",
        {
          usuario: usuarioAdm,
          auth_mode: "cookie",
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
        await (auth as any).use("api").invalidateToken();
      } catch (e) {
        // fallback para logout genérico
        await auth.logout();
      }
      clearAuthCookie(response);

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
