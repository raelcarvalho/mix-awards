---
name: ai-e2e-playwright
description: Use para obrigatoriedade de fluxo E2E com Playwright em mudanças funcionais.
---

# ai-e2e-playwright

## Quando usar
Use este skill sempre que houver mudança funcional em UI, fluxo de usuário ou integração API.

## Fluxo padrão
1. Preparar projeto (uma vez):
- `powershell -ExecutionPolicy Bypass -File C:\Users\rafae\.ai-tooling\scripts\bootstrap-e2e.ps1 -ProjectPath <repo>`
2. Executar testes:
- `npx playwright test`
3. Em PR/entrega, incluir:
- caminho feliz
- cenário de erro principal
- evidência de execução (report/log)

## Regras
- Não encerrar tarefa sem ao menos um smoke E2E passando na feature alterada.
- Em bugfix, primeiro reproduzir com teste que falha, depois corrigir.

## Referência oficial
- https://playwright.dev
- https://www.npmjs.com/package/@playwright/mcp

