declare module '@ioc:Adonis/Core/Validator' {
  interface Rules {
    telefone(): Rule
    cpf(): Rule
    dataValidade(): Rule
    cep(): Rule
    venda_ativa(): Rule
  }
}
