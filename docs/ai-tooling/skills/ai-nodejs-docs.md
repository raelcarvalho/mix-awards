---
name: ai-nodejs-docs
description: Use para tarefas Node.js com foco em API oficial, Context7 e validação de comportamento por versão.
---

# ai-nodejs-docs

## Quando usar
Use este skill para tarefas Node.js (API core, streams, fs, process, child_process, timers, modules, diagnostics).

## Fluxo
1. Resolver biblioteca no Context7: `node.js`, `node`, ou pacote específico.
2. Consultar documentação atual via Context7.
3. Confirmar comportamento com referência oficial: `https://nodejs.org/docs/latest/api/`.
4. Implementar e validar com teste mínimo.

## Regras
- Priorizar APIs nativas antes de adicionar dependências.
- Evitar exemplos antigos sem checar versão atual do Node em uso.
- Para mudanças sensíveis (filesystem/process/network), incluir teste de falha e sucesso.

## Referência oficial
- https://nodejs.org/docs/latest/api/

