---
name: ai-adonis-docs-mcp
description: Use para tarefas AdonisJS e para decidir quando aplicar @jrmc/adonis-mcp por projeto.
---

# ai-adonis-docs-mcp

## Quando usar
Use este skill para backend AdonisJS, incluindo rotas, validação, auth, ORM e jobs.

## Decisão: usar adonis-mcp?
Use `@jrmc/adonis-mcp` somente quando o objetivo for expor o sistema Adonis como servidor MCP para clientes de IA.
Não é obrigatório para desenvolvimento normal de API web.

## Fluxo
1. Consultar documentação oficial Adonis.
2. Para integrações de IA no app Adonis, avaliar adonis-mcp.
3. Se necessário, instalar no projeto:
- `node ace add @jrmc/adonis-mcp`
- Configurar rota MCP em `start/routes.ts`
- Excluir rota MCP do CSRF quando aplicável.

## Regras
- Não instalar adonis-mcp globalmente sem caso de uso.
- Tratar adonis-mcp como dependência por projeto.

## Referência oficial
- https://docs.adonisjs.com
- https://packages.adonisjs.com/packages/adonis-mcp

