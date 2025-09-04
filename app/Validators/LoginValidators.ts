// app/Validators/LoginValidators.ts
import { rules, schema } from "@ioc:Adonis/Core/Validator";

export default class LoginValidators {
  public login() {
    const mensagensLogin: Object = {
      required: "A {{ field }} é obrigatorio!",
      email: "É necessario enviar um email válido.",
      token: "É necessario enviar um token válido.",
    };

    const postSchema = schema.create({
      email: schema.string({ trim: true }, [
        rules.email(),
        rules.maxLength(100),
      ]),
      senha: schema.string({ trim: true }, [
        rules.required(),
        rules.maxLength(100),
      ]),
      token: schema.string.optional(),
    });

    return { schema: postSchema, mensagensLogin };
  }

  public cadastro() {
    const mensagensLogin: Object = {
      required: "A {{ field }} é obrigatorio!",
      email: "É necessario enviar um email válido.",
    };

    const postSchema = schema.create({
      nome: schema.string({ trim: true }, [
        rules.required(),
        rules.maxLength(100),
      ]),
      email: schema.string({ trim: true }, [
        rules.email(),
        rules.maxLength(100),
      ]),
      senha: schema.string({ trim: true }, [
        rules.required(),
        rules.maxLength(100),
      ]),
      nome_normalizado: schema.string({ trim: true }, [
        rules.required(),
        rules.maxLength(100),
      ]),
    });

    return { schema: postSchema, mensagensLogin };
  }

  public alterarSenha() {
    const mensagem: Object = {
      required: "A {{ field }} é obrigatorio!",
      email: "É necessario enviar um email válido.",
      tipo_notificacao: "O tipo de notificacao deve ser EMAIL ou SMS",
    };

    const postSchema = schema.create({
      nova_senha: schema.string({ trim: true }, [rules.required()]),
      senha_anterior: schema.string({ trim: true }, [rules.required()]),
    });

    return { schema: postSchema, mensagem };
  }

  public recuperarSenha() {
    const mensagens = {
      required: "O campo {{ field }} é obrigatório.",
      email: "Envie um email válido.",
    };

    const postSchema = schema.create({
      email: schema.string({ trim: true }, [rules.required(),rules.email(),rules.maxLength(150),]),
    });

    return { schema: postSchema, messages: mensagens };
  }
}
