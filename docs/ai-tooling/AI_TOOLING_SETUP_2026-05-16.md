# AI Tooling Global Setup (Codex/Claude/Cursor/OpenCode)

Data da execução: 2026-05-16

## 1) Objetivo
Configurar um stack global de ferramentas de IA fora da raiz do projeto, reutilizável em múltiplos repositórios:
- OpenCode
- RTK (Token optimizer)
- Superpowers
- Context7
- Playwright + Playwright MCP
- Svelte MCP
- Adonis MCP (avaliação de necessidade)

## 2) Estrutura global criada
- `C:\Users\rafae\.ai-tooling`
  - `docs\`
  - `scripts\`
  - `logs\`
  - `tmp\`
  - `repos\` (clones de referência)

## 3) Instalação item por item (executado)

### 3.1 OpenCode
- Instalado globalmente via npm:
  - `npm install -g opencode-ai@latest`
- Versão validada:
  - `opencode 1.15.3`
- Ajuste Windows aplicado:
  - Definido `XDG_CONFIG_HOME=C:\Users\rafae\.ai-tooling\xdg` (escopo usuário)
  - Motivo: evitar falha `EEXIST` no path padrão `~/.config/opencode`.

### 3.2 RTK
- Instalado via binário oficial Windows da release `v0.40.0`:
  - `rtk-x86_64-pc-windows-msvc.zip`
- Binário em:
  - `C:\Users\rafae\.local\bin\rtk.exe`
- Validação:
  - `rtk --version` => `rtk 0.40.0`
  - `rtk gain` => funcional

### 3.3 Superpowers
- Repositório clonado para referência:
  - `C:\Users\rafae\.ai-tooling\repos\superpowers`
- Codex:
  - marketplace adicionado: `obra/superpowers`
  - skills sincronizadas em `C:\Users\rafae\.codex\skills\superpowers`
- Claude:
  - skills sincronizadas em `C:\Users\rafae\.claude\skills\superpowers`
  - payload plugin espelhado em `C:\Users\rafae\.claude\plugins\superpowers`
- Cursor:
  - skills sincronizadas em `C:\Users\rafae\.cursor\skills\superpowers`
  - payload plugin espelhado em `C:\Users\rafae\.cursor\plugins\superpowers`
- OpenCode:
  - plugin instalado por pacote local (workaround Windows oficial do projeto):
    - `npm install superpowers@git+https://github.com/obra/superpowers.git --prefix C:\Users\rafae\.ai-tooling\opencode`
  - configurado em `opencode.json` com path local do plugin.

### 3.4 Context7
- Setup oficial executado em modo MCP para:
  - Codex
  - Claude
  - Cursor
  - OpenCode
- Resultado:
  - MCPs registrados
  - regras instaladas
  - skill `context7-mcp` instalada

### 3.5 Playwright + Playwright MCP
- MCP configurado globalmente em Codex/Claude/Cursor/OpenCode com:
  - `npx -y @playwright/mcp@latest --headless --browser chromium`
- OpenCode healthcheck confirmou `toolCount=23` no Playwright MCP.

### 3.6 Svelte MCP
- MCP remoto configurado globalmente em Codex/Claude/Cursor/OpenCode:
  - `https://mcp.svelte.dev/mcp`
- OpenCode healthcheck confirmou conexão e criação do client.

### 3.7 Adonis MCP (avaliação)
Conclusão técnica:
- `@jrmc/adonis-mcp` NÃO deve ser instalado globalmente sem caso de uso.
- É dependência por projeto Adonis quando você quer expor o app como servidor MCP.
- Instalação por projeto:
  - `node ace add @jrmc/adonis-mcp`

## 4) Configuração global aplicada (fora da raiz do projeto)

### Codex
- `C:\Users\rafae\.codex\config.toml`
- Entradas MCP ativas:
  - context7
  - svelte
  - playwright
- Marketplace Superpowers registrado.

### Claude
- `C:\Users\rafae\.claude.json`
- MCPs ativos:
  - context7 (http)
  - svelte (http)
  - playwright (stdio)

### Cursor
- `C:\Users\rafae\.cursor\mcp.json`
- MCPs ativos:
  - context7
  - svelte
  - playwright

### OpenCode
- Config principal:
  - `C:\Users\rafae\.ai-tooling\xdg\opencode\opencode.json`
- MCPs ativos:
  - context7
  - svelte
  - playwright
- Plugin ativo:
  - superpowers (path local)

## 5) Skills e tools criadas

### Skills universais
Criadas em `C:\Users\rafae\.agents\skills\` e espelhadas para Codex/Claude/Cursor:
- `ai-nodejs-docs`
- `ai-react-docs`
- `ai-svelte-docs-mcp`
- `ai-adonis-docs-mcp`
- `ai-e2e-playwright`
- `ai-rtk-token-efficiency`

### Scripts/tools globais
Em `C:\Users\rafae\.ai-tooling\scripts`:
- `validate-ai-tooling.ps1` (validação completa)
- `tooling-healthcheck.cmd` (atalho)
- `bootstrap-e2e.ps1` (bootstrap de Playwright por projeto)
- `start-playwright-mcp.cmd`
- `start-context7-mcp.cmd`
- `rtkx.cmd`

## 6) Rotina E2E padrão (obrigatória)

### Bootstrap inicial por projeto
```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\rafae\.ai-tooling\scripts\bootstrap-e2e.ps1 -ProjectPath <CAMINHO_DO_PROJETO> -BaseUrl http://localhost:3333
```

### Execução
```bash
npx playwright test
```

### Regra de entrega
Toda feature deve ter ao menos:
- 1 fluxo feliz E2E
- 1 cenário de erro relevante E2E

## 7) RTK para reduzir tokens (procedimento prático)

### Comandos base
```bash
rtk --version
rtk gain
rtk gain --graph
```

### Substituições recomendadas
- `git status` -> `rtk git status`
- `git diff` -> `rtk git diff`
- `ls`/árvore -> `rtk ls .`
- `playwright test` -> `rtk playwright test`
- testes verbosos -> `rtk test <comando>`

### Política operacional
- Use RTK por padrão para saídas longas.
- Só rode comando bruto quando necessário para diagnóstico fino.
- Após diagnóstico, volte para RTK.

## 8) Uso por linguagem

### Node
- Ativar skill: `ai-nodejs-docs`
- Base oficial: `https://nodejs.org/docs/latest/api/`
- Sempre cruzar com Context7 quando envolver libs externas.

### React
- Ativar skill: `ai-react-docs`
- Base oficial: `https://react.dev`
- Em qualquer mudança visual/fluxo, acionar rotina E2E.

### Svelte
- Ativar skill: `ai-svelte-docs-mcp`
- Usar Svelte MCP remoto + docs oficiais.

### Adonis
- Ativar skill: `ai-adonis-docs-mcp`
- Base oficial: `https://docs.adonisjs.com`
- Só usar `@jrmc/adonis-mcp` quando houver requisito MCP no app.

## 9) Validação executada
- JSON configs parse OK:
  - Cursor MCP
  - Claude config
  - OpenCode config
- TOML parse/read OK:
  - Codex config
- Binários OK:
  - RTK 0.40.0
  - OpenCode 1.15.3
- OpenCode runtime healthcheck:
  - superpowers plugin carregado
  - context7/svelte/playwright MCP conectados

## 10) Comandos de manutenção

### Revalidar stack
```cmd
tooling-healthcheck.cmd
```

### Atualizar referência dos repositórios
```powershell
git -C C:\Users\rafae\.ai-tooling\repos\superpowers pull --ff-only
git -C C:\Users\rafae\.ai-tooling\repos\context7 pull --ff-only
git -C C:\Users\rafae\.ai-tooling\repos\rtk pull --ff-only
```

---

## Fontes oficiais utilizadas
- OpenCode: https://opencode.ai
- RTK: https://github.com/rtk-ai/rtk
- Superpowers: https://github.com/obra/superpowers
- Context7: https://context7.com e https://github.com/upstash/context7
- Playwright: https://playwright.dev e https://www.npmjs.com/package/@playwright/mcp
- Svelte MCP: https://svelte.dev/docs/cli/mcp
- Adonis MCP: https://packages.adonisjs.com/packages/adonis-mcp
- Node.js docs: https://nodejs.org/docs/latest/api/
- Adonis docs: https://docs.adonisjs.com
