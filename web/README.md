# MIX AWARDS — Frontend (React 19 + Vite + Tailwind CSS 4)

Esta pasta substitui o Next.js que havia em `web/`. O frontend agora usa **Vite** como bundler e **React 19** como framework de UI, com **Tailwind CSS 4**.

---

## Estrutura

```
web/
├── index.html               ← entry point do Vite
├── vite.config.ts           ← proxy para AdonisJS + build config
├── package.json             ← dependências React 19 + Vite + Tailwind 4
├── tsconfig*.json           ← configuração TypeScript
├── scripts/
│   └── copy-to-public.mjs  ← copia o build para ../public/
└── src/
    ├── main.tsx             ← entry React
    ├── App.tsx              ← roteamento entre páginas
    ├── index.css            ← Tailwind 4 + fontes + variáveis de tema
    ├── services/
    │   └── api.ts           ← todos os endpoints do AdonisJS mapeados
    ├── hooks/
    │   └── useAuth.tsx      ← contexto de autenticação (substitui auth.js)
    ├── components/
    │   ├── layout/
    │   │   └── AppLayout.tsx ← sidebar + topbar + modal de login
    │   └── ui/
    │       └── Card.tsx      ← Card, StatCard, Btn, Toast
    └── pages/
        ├── HomePage.tsx          ← index.html
        ├── DashboardPage.tsx     ← meu dashboard com radar + gráficos
        ├── RankingPage.tsx       ← ranking completo com pódio
        ├── ShopPage.tsx          ← loja com compra de pacotes e cápsulas
        ├── AlbumPage.tsx         ← álbum de figurinhas paginado
        ├── AlbumStickersPage.tsx ← álbum de stickers com reveal
        └── PartidasPage.tsx      ← histórico de partidas + importar (admin)
```

---

## Setup inicial

### 1. Remover arquivos do Next.js

Dentro da pasta `web/`, apague:
```
.next/
next.config.ts
next-env.d.ts
postcss.config.mjs   ← não é mais necessário (Tailwind 4 usa plugin Vite)
```

### 2. Instalar dependências

```bash
cd web
npm install
```

### 3. Rodar em desenvolvimento

Abra **dois terminais**:

```bash
# Terminal 1 — Backend AdonisJS (na raiz do PROJETOGC)
node ace serve --watch
# Roda em http://localhost:3333

# Terminal 2 — Frontend Vite (dentro de web/)
cd web
npm run dev
# Roda em http://localhost:5173
# Todas as chamadas /api /login /shop etc são proxiadas para :3333
```

Acesse **http://localhost:5173** para ver o frontend.

---

## Build para produção

```bash
cd web
npm run build:prod
```

Isso:
1. Compila o TypeScript
2. Gera o bundle em `web/dist/`
3. Copia automaticamente para `../public/` (pasta do AdonisJS)

O AdonisJS já serve os arquivos estáticos de `public/` — nenhuma alteração no backend é necessária.

---

## Páginas disponíveis

| Rota (sidebar) | Página | Endpoint principal |
|---|---|---|
| Início | HomePage | `/api/partida/ranking` |
| Meu Dashboard | DashboardPage | `/api/partida/ranking` + `/api/partida/listar` |
| Partidas | PartidasPage | `/api/partida/listar` |
| Ranking | RankingPage | `/api/partida/ranking` |
| Álbum | AlbumPage | `/album` |
| Álbum Stickers | AlbumStickersPage | `/album/stickers` |
| Shop | ShopPage | `/shop/comprar` + `/shop/comprar-capsulas` |
| Importar (admin) | ImportarPage | `/api/partida/importar-json` |

---

## Tailwind CSS 4

O projeto usa Tailwind CSS 4 com o novo plugin Vite (`@tailwindcss/vite`). Não há `tailwind.config.js` — a configuração de tema fica em `src/index.css` usando `@theme`.

**Não use** `postcss.config.mjs` — o Tailwind 4 não precisa mais do PostCSS separado.
