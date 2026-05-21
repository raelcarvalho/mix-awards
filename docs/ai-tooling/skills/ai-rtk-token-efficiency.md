---
name: ai-rtk-token-efficiency
description: Use para reduzir tokens com RTK em comandos de saída extensa.
---

# ai-rtk-token-efficiency

## Quando usar
Use este skill quando o agente executar comandos com saída grande (git diff/status, testes, logs, árvores de arquivos).

## Objetivo
Reduzir consumo de tokens com `rtk` sem perder contexto crítico.

## Fluxo
1. Verificar instalação:
- `rtk --version`
- `rtk gain`
2. Preferir wrappers RTK para comandos verbosos:
- `rtk git status`
- `rtk git diff`
- `rtk ls .`
- `rtk playwright test`
- `rtk test <comando>`
3. Monitorar economia:
- `rtk gain --graph`

## Regras
- Em troubleshooting profundo, alternar para comando bruto apenas quando necessário.
- Voltar para RTK após isolar causa do problema.

## Referência oficial
- https://github.com/rtk-ai/rtk

