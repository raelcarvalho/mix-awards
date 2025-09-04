# MIX AWARDS — Álbum, Figurinhas, Stickers e Ranking a partir das partidas

> Plataforma gamificada que importa/contabiliza partidas, calcula estatísticas e recompensa os jogadores com **Gold**. O Gold é usado para comprar **pacotes** (cápsulas) de **figurinhas** e **stickers de assinaturas** para completar o álbum e disputar o **ranking**.

---

## Sumário
- [Visão geral](#visão-geral)
- [Principais funcionalidades](#principais-funcionalidades)
- [Arquitetura e Stack](#arquitetura-e-stack)
- [Como rodar localmente](#como-rodar-localmente)
- [Ambiente (.env)](#ambiente-env)
- [Modelos e entidades](#modelos-e-entidades)
- [Fluxos do produto](#fluxos-do-produto)
  - [Importação/Contabilização de partidas](#importaçãocontabilização-de-partidas)
  - [Sistema de Ranking](#sistema-de-ranking)
  - [Carteira (Gold)](#carteira-gold)
  - [Shop / Pacotes (Cápsulas)](#shop--pacotes-cápsulas)
  - [Abertura de cápsulas](#abertura-de-cápsulas)
  - [Álbum de Figurinhas](#álbum-de-figurinhas)
  - [Álbum de Stickers (Assinaturas)](#álbum-de-stickers-assinaturas)
- [API (exemplos de endpoints)](#api-exemplos-de-endpoints)
- [Probabilidades e Raridades](#probabilidades-e-raridades)
- [Interfaces Web](#interfaces-web)
- [Seeds e dados de exemplo](#seeds-e-dados-de-exemplo)
- [Roadmap](#roadmap)
- [Contribuição](#contribuição)
- [Licença](#licença)

---

## Visão geral
O **MIX AWARDS** é um backend + front simples que:
1. **Lê/Importa partidas** (ex.: JSON capturado da GamersClub via aba *Network*)
2. **Salva estatísticas por jogador**, determina o time vencedor e **atualiza ranking**
3. **Recompensa com Gold** a cada partida processada
4. Permite **comprar pacotes** (cápsulas) com o Gold
5. **Abre os pacotes** revelando figurinhas/stickers conforme **raridades** e **probabilidades**
6. Mantém dois álbuns: **Figurinhas (jogadores)** e **Stickers de assinaturas**
7. Exibe **ranking** (com regras de pontuação) e **painéis** para acompanhamento

---

## Principais funcionalidades
- **Importar partidas** a partir de JSON oficial da plataforma de jogo (ex.: GamersClub)
- **Processamento de estatísticas** (kills, assists, deaths, ADR, FK, HS etc.)
- **Cálculo de vitória por partida** e incremento de métricas por jogador
- **Sistema de Ranking** por pontuação, com regras de pontos configuráveis
- **Moeda interna (Gold)** vinculada ao jogador
- **Shop (cápsulas/pacotes)** com débito de Gold, itens por pacote e status
- **Abertura de cápsula** individual ou “revelar tudo” com animações (roleta/holográfico)
- **Álbum de Figurinhas** (cards de jogadores) e **Álbum de Stickers** (assinaturas)
- **Raridades e probabilidades** por item
- **Painéis/relatórios** (admin) e ordenação de ranking por colunas (front)

---

## Arquitetura e Stack
- **Backend:** Node.js + **AdonisJS** (TypeScript)
- **Banco:** PostgreSQL
- **ORM:** Lucid (Adonis)
- **Autenticação:** padrão Adonis (token/JWT)
- **Front:** páginas estáticas (HTML/CSS/JS) + componentes JS utilitários (ex.: `auth.js`)
- **Uploads:** diretório `/uploads` (ex.: imagens de figurinhas/stickers/cápsulas)

> A importação de partidas é feita pelo **controller** que recebe e processa um JSON consolidado (o mesmo visto na aba *Network* da página de partida), sem dependência de API pública externa.

---

## Como rodar localmente
1. **Pré-requisitos:** Node LTS, npm/yarn, PostgreSQL 13+
2. **Clonar o repositório**
3. **Instalar dependências**
   ```bash
   npm install
   # ou
   yarn
   ```
4. **Configurar `.env`** (ver seção abaixo) e gerar a APP_KEY
   ```bash
   node ace generate:key
   ```
5. **Rodar migrações e seeds**
   ```bash
   node ace migration:run
   node ace db:seed   # (opcional, se houver seeds)
   ```
6. **Subir em dev**
   ```bash
   node ace serve --watch
   ```
7. Acesse o front estático (páginas HTML) pelo **servidor web** configurado ou via a pasta `public/`.

---

## Ambiente (.env)
Exemplo mínimo:
```env
# App
PORT=3333
HOST=0.0.0.0
NODE_ENV=development
APP_KEY=seu_app_key

# Banco de dados
DB_CONNECTION=pg
PG_HOST=127.0.0.1
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DB_NAME=(SEU NOME DO BANCO)

# Itens/pacotes
ITENS_POR_PACOTE=4
# Probabilidades podem ser definidas via seed/tabela ou arquivo de config
```

> Outras chaves (e.g., storage, CORS, auth) conforme necessidade do projeto.

---

## Modelos e entidades
> Nomes/tabelas podem variar por projeto; abaixo está um **mapa conceitual** com os principais campos usados.

- **Jogadores (`tb_jogadores`)**
  - `id`, `nome`, `usuario_adm_id?`, `nome_normalizado?`
  - `qtd_partidas`, `pontos`, `vitorias`

- **Partidas (`tb_partidas`)**
  - `id`, infos do confronto (mapa, times, placar), `created_at`

- **PartidasJogadores (pivot `tb_partidas_jogadores`)**
  - `partidas_id`, `jogadores_id`
  - estatísticas: `kills`, `assists`, `deaths`, `adr`, `fk`, `hs`, `kdr`, `kast`...
  - `partida_ganha` (bool)

- **Wallet/Gold** (colunas no jogador ou tabela própria de extrato)
  - saldo atual, lançamentos de crédito/débito

- **Pacotes/Cápsulas (`tb_pacotes`)**
  - `id`, `jogador_id`, `preco_gold`, `qtd_itens`, `status` (fechado/aberto), `aberto_em`

- **Figurinhas (`tb_figurinhas`)**
  - `id`, `nome`, `imagem`, `raridade`, `ativo`

- **Stickers (`tb_stickers`)** (assinaturas)
  - `id`, `nome`, `imagem`, `raridade`, `ativo`

- **Álbum Figurinhas (`tb_album_figurinhas`)**
  - `jogador_id`, `figurinha_id`, `colado_em`

- **Álbum Stickers (`tb_album_stickers`)** / **Assinaturas (`tb_album_assinaturas`)**
  - `jogador_id`, `sticker_id`, `colado_em`

> Observação: o projeto mantém **dois álbuns** distintos (figurinhas de jogadores **e** stickers/assinaturas). As quantidades (ex.: 60 figurinhas, 24 stickers) são **parametrizáveis** via seed/config.

---

## Fluxos do produto

### Importação/Contabilização de partidas
1. O JSON da partida (times, jogadores, estatísticas completas) é enviado ao endpoint de importação
2. O serviço cria/atualiza **Partida** e **PartidasJogadores** (stats por jogador)
3. Determina o **time vencedor** (compara `score_a` vs `score_b`)
4. Marca `partida_ganha = true` **apenas** para os jogadores do time vencedor
5. Incrementa `qtd_partidas` **uma vez por jogador** na partida
6. Atualiza **pontos** no ranking (ver regras abaixo)
7. **Credita Gold** conforme a política definida (ex.: por participação e/ou desempenho)

### Sistema de Ranking
Regras de pontuação (por **partida**):
- **Kill:** +1 ponto por kill
- **ADR:**
  - `< 50` → +5 pts
  - `50 a 100` → +10 pts
  - `> 100` → +20 pts
- **First Kill (FK):** +1 ponto por FK
- **Vitória:** +20 pts
- **Derrota:** +10 pts

**Bônus por quantidade de partidas (`qtd_partidas`)** — marcos cumulativos:
- **15 partidas** → `+20` pts
- **20 partidas** → `+40` pts
- **25 partidas** → `+60` pts
- **30 partidas** → `+80` pts

> Observações:
> - A vitória é atribuída **somente** aos jogadores do time vencedor.
> - A regra de bônus é cumulativa por patamar alcançado.
> - Ordenações adicionais (por K/D, ADR, vitórias) podem ser feitas no front.

### Carteira (Gold)
- Saldo em **Gold** atrelado ao jogador
- **Créditos**: processamento de partidas, bônus, campanhas
- **Débitos**: compra de pacotes/cápsulas (shop)
- Endpoint para **consultar saldo** e **extrato** (opcional)

### Shop / Pacotes (Cápsulas)
- Compra de **pacotes fechados** (status `fechado`)
- Cada pacote tem `qtd_itens` (padrão: **4** — parametrizável)
- Débito imediato do **Gold** na compra
- Listagem de pacotes **fechados** por jogador

**Exemplo de resposta (compra):**
```json
{
  "sucesso": true,
  "mensagem": "Pacotes comprados com sucesso.",
  "resultados": {
    "pacoteIds": [1],
    "goldDebitado": 10,
    "saldoAtual": 30,
    "precoPacote": 10,
    "itensPorPacote": 4
  }
}
```

**Exemplo de listagem (fechados):**
```json
{
  "sucesso": true,
  "mensagem": "Pacotes fechados listados.",
  "resultados": {
    "pacotes": [
      { "id": 1, "jogador_id": 77, "preco_gold": 10, "qtd_itens": 4, "status": "fechado", "aberto_em": null }
    ]
  }
}
```

### Abertura de cápsulas
- Ao **abrir** um pacote, o sistema sorteia **N itens** de acordo com as **probabilidades por raridade**
- Itens são revelados com **animação** (roleta, 3D/holográfico) no front
- Botões: **Abrir** (um por vez) e **Revelar tudo**
- Cada item sorteado é **adicionado ao inventário** do jogador e pode ser **colado** no álbum

### Álbum de Figurinhas
- Grelha paginada (ex.: 10 por página) com **estado**: colada / não obtida / obtida (não colada)
- **Colagem**: ao colar, registra `colado_em` no vínculo do álbum
- **Contadores** por página e **percentual** de completude

### Álbum de Stickers (Assinaturas)
- Álbum separado para stickers (ex.: **24** posições)
- Onde não há sticker, exibe **imagem da cápsula** (`/uploads/stickers/capsula_sticker.png`)
- Abertura/colagem seguem o mesmo padrão das figurinhas

---

## API (exemplos de endpoints)
> Os caminhos podem variar conforme a sua organização de rotas. Exemplos a seguir:

**Auth**
- `POST /auth/login` — autentica e retorna token

**Partidas**
- `POST /partidas/importar` — recebe JSON da partida, processa estatísticas
- `GET /partidas` — lista partidas
- `GET /partidas/:id` — detalhes de uma partida (inclui stats por jogador)
- `DELETE /partidas/:id` — **admin**, exclui partida e **recalcula ranking**

**Ranking**
- `GET /ranking/jogadores?ordenar=pontos|kills|adr|vitorias...`
- `GET /ranking/top3`

**Wallet**
- `GET /wallet/saldo`
- `GET /wallet/extrato` (opcional)

**Shop / Pacotes**
- `POST /shop/pacotes/comprar` — debita Gold e cria pacote `fechado`
- `GET /shop/pacotes/fechados` — lista pacotes do jogador
- `POST /shop/pacotes/:id/abrir` — sorteia itens e marca pacote como `aberto`

**Álbuns**
- `GET /album/figurinhas` — estado do álbum de figurinhas
- `POST /album/figurinhas/colar` — cola uma figurinha
- `GET /album/stickers` — estado do álbum de stickers
- `POST /album/stickers/colar` — cola um sticker

---

## Probabilidades e Raridades
- Raridades recomendadas: **Comum**, **Rara**, **Épica**, **Lendária**
- Probabilidades **parametrizáveis** (ex.: via seed/tabela `tb_raridades` ou `config/raridade.ts`)
- Cada item (figurinha/sticker) possui um campo `raridade`
- A abertura de pacote sorteia **com base na raridade**

> O projeto já contempla **ajuste de percentuais**; mantenha os valores em um único ponto de verdade (seed/config) para facilitar o balanceamento.

---

## Interfaces Web
- **Ranking dos jogadores** com **ordenação por coluna** (maior→menor)
- **Pódio** com destaque visual (1º central e ampliado)
- **Shop/Cápsulas** com pré-visualização dos itens possíveis
- **Abertura de cápsulas** com animações (roleta, 3D/holográfico, contorno neon)
- **Álbuns** com placeholders de cápsula nos espaços vazios, contadores e progresso

Arquivos de estilo/JS comuns:
- `/css/base.css`, `/css/layout.css`, `/css/components.css`, ...
- `/js/auth.js` (login modal, utilidades de navegação)

---

## Seeds e dados de exemplo
- **Raridades** e **probabilidades**
- **Figurinhas** e **Stickers** iniciais (nomes, imagens, raridade)
- **Jogadores** de teste
- **Pacotes** e **Gold** inicial (opcional)

> Recomenda-se incluir **scripts de seed** para facilitar o onboarding e os ambientes de demonstração.

---

## Roadmap
- **Mercado/Troca** de duplicadas entre jogadores
- **Coleções/Temporadas** e conquistas
- **Recompensas dinâmicas** por missões/diárias
- **Leaderboard semanal/mensal** e histórico
- **Mobile-first** com PWA
- **Integração oficial** (se disponível) com provedores de partidas

---

## Contribuição
1. Faça um fork do repositório
2. Crie uma branch feature: `git checkout -b feat/minha-feature`
3. Commit: `git commit -m "feat: minha feature"`
4. Push: `git push origin feat/minha-feature`
5. Abra um Pull Request

> Padrões sugeridos: Conventional Commits, ESLint/Prettier, Husky (pré-commit), testes unitários onde aplicável.

---

## Licença
Defina a licença do projeto conforme sua estratégia (ex.: **MIT**, **AGPL**, **Proprietária**). No momento, o repositório está **sem licença definida**.

---

### Nota
Este README descreve a implementação atual do MIX AWARDS conforme as regras e fluxos presentes no projeto: dois álbuns (figurinhas e stickers), ranking com as regras de pontuação especificadas, shop/cápsulas com itens por pacote e probabilidades configuráveis, e importação de partidas via JSON oficial da plataforma de jogo...

