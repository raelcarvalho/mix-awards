/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| This file is dedicated for defining HTTP routes. A single file is enough
| for majority of projects, however you can define routes in different
| files and just make sure to import them inside this file. For example
|
| Define routes in following two files
| ├── start/routes/cart.ts
| ├── start/routes/customer.ts
|
| and then import them inside `start/routes.ts` as follows
|
| import './routes/cart'
| import './routes/customer'
|
*/
import Application from "@ioc:Adonis/Core/Application";
import fs from "fs";
import Route from "@ioc:Adonis/Core/Route";
import { clearAuthCookie } from "App/Utils/AuthCookie";

Route.get("/", ({ response }) => {
  response.stream(fs.createReadStream(Application.publicPath("index.html")));
});

Route.get("/index", ({ response }) => {
  response.stream(fs.createReadStream(Application.publicPath("index.html")));
});

const spaRoutes = [
  "/dashboard",
  "/partidas",
  "/tirar-time",
  "/ranking",
  "/album",
  "/album-stickers",
  "/shop",
  "/importar",
  "/copa-do-mundo",
  "/mix-awards",
  "/confrontos",
];

spaRoutes.forEach((path) => {
  Route.get(path, ({ response }) => {
    response.stream(fs.createReadStream(Application.publicPath("index.html")));
  });
});

Route.get("/login-html", ({ response }) => {
  response.stream(fs.createReadStream(Application.publicPath("login.html")));
});

Route.get("/cadastrar-html", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("cadastrar.html"))
  );
});

Route.get("/alterar-senha-html", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("alterar-senha.html"))
  );
});

Route.get("/audios/:file", async ({ params, response }) => {
  const audioPath = Application.publicPath(`audios/${params.file}`);

  if (!fs.existsSync(audioPath)) {
    return response
      .status(404)
      .send({ error: "Arquivo de áudio não encontrado" });
  }

  return response.download(audioPath);
});

Route.get("/js/:file", async ({ params, response }) => {
  return response.download(Application.publicPath(`js/${params.file}`));
});
Route.get("/css/:file", async ({ params, response }) => {
  return response.download(Application.publicPath(`css/${params.file}`));
});
Route.get("/img/:file", async ({ params, response }) => {
  return response.download(Application.publicPath(`img/${params.file}`));
});

Route.get("/consultar-partidas", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("consultar-partida.html"))
  );
});
Route.get("/consultar-partidas-html", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("consultar-partida.html"))
  );
});
Route.get("/detalhes-partida-html", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("detalhes-partida.html"))
  );
});

Route.get("/ranking-jogadores-html", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("ranking-jogadores.html"))
  );
});

Route.get('/v2/ranking-jogadores-html', ({ response }) => {
  return response.stream(
    fs.createReadStream(Application.publicPath('ranking-v2.html'))
  )
})

Route.get("/importar-partida-html", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("importar-partida.html"))
  );
});

Route.get("/shop-html", ({ response }) => {
  response.stream(fs.createReadStream(Application.publicPath("shop.html")));
});

Route.get("/album-html", ({ response }) => {
  response.stream(fs.createReadStream(Application.publicPath("album.html")));
});

Route.get("/album-stickers-html", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("album-stickers.html"))
  );
});

Route.get("/tirar-mix-html", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("tirar-mix.html"))
  );
});

Route.get("/abrir-pacote-html", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("abrir-pacote.html"))
  );
});

Route.get("/abrir-capsula-html", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("abrir-capsula.html"))
  );
});

Route.get("/uploads/figurinhas/:file", ({ params, response }) => {
  const abs = Application.publicPath(`uploads/figurinhas/${params.file}`);
  if (!fs.existsSync(abs)) {
    return response.status(404).send("Arquivo não encontrado");
  }
  // dica: já define o content-type; download também funciona
  response.type("image/png");
  return response.download(abs);
});

Route.get("/uploads/shop/:file", ({ params, response }) => {
  const abs = Application.publicPath(`uploads/shop/${params.file}`);
  if (!fs.existsSync(abs)) {
    return response.status(404).send("Arquivo não encontrado");
  }
  response.type("image/png");
  return response.download(abs);
});

Route.get("/uploads/stickers/:file", ({ params, response }) => {
  const abs = Application.publicPath(`uploads/stickers/${params.file}`);
  if (!fs.existsSync(abs)) {
    return response.status(404).send("Arquivo não encontrado");
  }
  // dica: já define o content-type; download também funciona
  response.type("image/png");
  return response.download(abs);
});

Route.get("/uploads/pix/:file", ({ params, response }) => {
  const abs = Application.publicPath(`uploads/pix/${params.file}`);
  if (!fs.existsSync(abs)) {
    return response.status(404).send("Arquivo não encontrado");
  }
  response.type("image/png");
  return response.download(abs);
});

Route.get(
  "/.well-known/appspecific/com.chrome.devtools.json",
  ({ response }) => {
    return response.noContent();
  }
);

Route.get("/favicon.ico", ({ response }) => {
  const p = Application.publicPath("favicon.ico");
  if (fs.existsSync(p)) return response.download(p);
  return response.noContent();
});

// FIGURINHA
Route.group(() => {
  Route.get("/figurinhas", "FigurinhasController.listar");
  Route.get("/figurinhas/:id", "FigurinhasController.mostrar");
  Route.post("/figurinhas", "FigurinhasController.cadastrar");
  Route.put("/figurinhas/:id", "FigurinhasController.atualizar");
  Route.delete("/figurinhas/:id", "FigurinhasController.excluir");
}).middleware("auth");

// ALBUM
Route.group(() => {
  Route.post("/album", "AlbumController.criarAlbum");
  Route.post("/album/pacotes/abrir", "AlbumController.abrirPacote");
  Route.post("/album/figurinhas", "AlbumController.cadastrarFigurinha");
}).middleware("auth");

// ALBUM API (separado da rota de página /album para evitar conflito no F5)
Route.group(() => {
  Route.get("/album", "AlbumController.meuAlbum");
  Route.post("/album/pacotes/abrir", "AlbumController.abrirPacote");
  Route.post("/album/figurinhas", "AlbumController.cadastrarFigurinha");
})
  .prefix("api")
  .middleware("auth:api");

// COPA API
Route.group(() => {
  Route.get("/copa", "CopaController.meuAlbum");
  Route.post("/copa/cartas/revelar", "CopaController.revelarCarta");
})
  .prefix("api")
  .middleware("auth:api");

Route.group(() => {
  Route.get("/album/stickers", "AlbumStickersController.meuAlbum");
  Route.get("/album/stickers/revelados", "AlbumStickersController.revelados");
  Route.post("/album/stickers/revelar", "AlbumStickersController.revelar");
}).middleware("auth");

// ALBUM STICKERS
Route.group(() => {
  Route.post("/album/stickers", "AlbumStickersController.criarAlbumSticker");
  // Route.get("/album/stickers", "AlbumStickersController.meuAlbum");
  Route.post(
    "/album/stickers/capsulas",
    "AlbumStickersController.abrirCapsulas"
  );
}).middleware("auth");

// JOGADOR
Route.group(() => {
  Route.get("/jogadores", "JogadoresController.listar");
  Route.get("/jogadores/gold", "JogadoresController.meuGold");
  Route.post(
    "/jogadores/vincular/:id",
    "JogadoresController.vincularUsuarioJogador"
  );
})
  .prefix("api")
  .middleware("auth:api");

Route.group(() => {
  Route.post(
    "/partidas/:id/creditar",
    "RecompensaController.creditarPosPartida"
  );
}).middleware("auth");

// STICKERS
Route.group(() => {
  Route.get("/stickers", "StickersController.listar");
  Route.post("/stickers", "StickersController.cadastrar");
}).middleware("auth");

// SHOP
Route.group(() => {
  Route.post("/shop/comprar", "ShopController.comprarPacotes");
  Route.post("/shop/comprar-capsulas", "ShopController.comprarCapsulas");
  Route.get(
    "/shop/listar-pacote-fechado",
    "ShopController.listarPacotesFechados"
  );
  // Route.get("/shop/cosmeticos", "ShopController.listarCosmeticos");
  // Route.post("/shop/cosmeticos/comprar", "ShopController.comprarCosmetico");
  // Route.post("/shop/cosmeticos/equipar", "ShopController.equiparCosmetico");
}).middleware("auth");

// LOGIN E CADASTRO
Route.group(() => {
  Route.post("/login", "LoginController.login");
});

Route.get("/auth/steam/login", "SteamAuthController.steamLogin");
Route.get("/auth/steam/callback", "SteamAuthController.steamCallback");

Route.post("/cadastrar", "LoginController.cadastrar");
Route.post("/recuperar-senha", "LoginController.recuperarSenha");
Route.post("/alterar-senha", "LoginController.alterarSenha").middleware(
  "auth:api"
);

Route.get("/shop/album-status", "AlbumController.status").middleware("auth");

Route.group(() => {
  Route.post("/logout", async ({ auth, response }) => {
    try {
      await (auth as any).use("api").invalidateToken();
    } catch {}
    clearAuthCookie(response);
    return response.ok({ mensagem: "Logout efetuado" });
  });
})
  .prefix("api")
  .middleware("auth:api");

Route.group(() => {
  Route.post("/importar-partida", "PartidaController.importarPartida");
  Route.post("/importar-json", "PartidaController.importarJson");
  Route.delete("/deletar/:id", "PartidaController.excluirPartida");
})
  .prefix("api/partida")
  .middleware("auth:api");

// TIRAR MIX
Route.group(() => {
  Route.post("tirar-mix/heartbeat", "TirarMixController.heartbeat");
  Route.get("tirar-mix/online", "TirarMixController.online");

  // sessão
  Route.get("tirar-mix/sessao/atual", "TirarMixController.sessaoAtual");
  Route.post("tirar-mix/sessao/nova", "TirarMixController.sessaoNova");
  Route.post("tirar-mix/entrar", "TirarMixController.entrar");
  Route.post("tirar-mix/sair", "TirarMixController.sair");
  Route.post("tirar-mix/mock/capitao-oponente", "TirarMixController.mockCapitaoOponente");
  Route.post("tirar-mix/mock/iniciar-oponente", "TirarMixController.mockIniciarOponente");
  Route.post("tirar-mix/mock/dados-oponente", "TirarMixController.mockRolarDadosOponente");
  Route.post("tirar-mix/mock/8-jogadores", "TirarMixController.mockOitoJogadores");
  Route.post("tirar-mix/mock/pick-aleatorio", "TirarMixController.mockPickAleatorio");

  // jogadores + stats
  Route.get(
    "tirar-mix/jogadores-disponiveis",
    "TirarMixController.jogadoresDisponiveis"
  );
  Route.get("tirar-mix/stats", "TirarMixController.stats");

  // convites de capitão
  Route.post(
    "tirar-mix/convites/capitaes",
    "TirarMixController.convidarCapitaes"
  );
  Route.get(
    "tirar-mix/convites/minha-situacao",
    "TirarMixController.conviteMinhaSituacao"
  );
  Route.post(
    "tirar-mix/convites/:token/aceitar",
    "TirarMixController.aceitarCapitao"
  );
  Route.post(
    "tirar-mix/convites/:token/recusar",
    "TirarMixController.recusarCapitao"
  );

  // draft
  Route.post("tirar-mix/draft/iniciar", "TirarMixController.iniciarDraftPost");
  Route.post("tirar-mix/aceitar", "TirarMixController.aceitarPartida");
  Route.post("tirar-mix/dados/rolar", "TirarMixController.rolarDados");
  Route.post("tirar-mix/draft/rolar-dados", "TirarMixController.rolarDados");
  Route.post("tirar-mix/draft/desfazer", "TirarMixController.undoPost");

  // picks (se usar a tela de draft)
  Route.post("tirar-mix/pick/:id?", "TirarMixController.pick");
  Route.post("tirar-mix/mapas/ban/:mapa?", "TirarMixController.banirMapa");

  // opcional (legacy)
  Route.get("tirar-mix/snapshot/:id", "TirarMixController.snapshot");
  Route.get("tirar-mix/snapshot", "TirarMixController.snapshot");
})
  .prefix("api")
  .middleware("auth:api");

// MIX AWARDS FINAL SEASON (cerimônia de encerramento)
Route.group(() => {
  Route.get("mixawards/final", "MixAwardsController.final");
  Route.get("mixawards/retrospectiva", "MixAwardsController.retrospectiva");
  Route.post("mixawards/resgatar", "MixAwardsController.resgatar");
  Route.post("mixawards/equipar", "MixAwardsController.equipar");
})
  .prefix("api")
  .middleware("auth:api");

Route.group(() => {
  Route.get("/steam/login-url", "SteamAuthController.steamLoginAuthUrl");
  Route.get("/steam/status", "SteamAuthController.steamStatus");
  Route.post("/steam/vincular-gc", "SteamAuthController.vincularGc");
})
  .prefix("api/auth")
  .middleware("auth:api");

// LEVELS (REST)
Route.group(() => {
  Route.get("/", "LevelController.lista");
  Route.get("/players/:id", "LevelController.jogador");
  Route.post("/simulations", "LevelController.simular");
})
  .prefix("api/levels")
  .middleware("auth:api");

// PARTIDA CONTROLLER
Route.group(() => {
  Route.get("/listar", "PartidaController.consultarPartidas");
  Route.get("/detalhes/:codigo", "PartidaController.detalhesPartida");
  Route.get("/ranking", "JogadoresController.listar");
}).prefix("api/partida");

// CONFRONTOS (head-to-head) — público, como o ranking
Route.group(() => {
  Route.get("/jogadores", "ConfrontosController.jogadores");
  Route.get("/", "ConfrontosController.comparar");
}).prefix("api/confrontos");

// PLAYERS (REST)
Route.group(() => {
  Route.get("/", "JogadoresController.listar");
  Route.get("/me", "JogadoresController.meuGold");
  Route.post("/:id/link", "JogadoresController.vincularUsuarioJogador");
})
  .prefix("api/players")
  .middleware("auth:api");

// MISSÕES (REST)
Route.group(() => {
  Route.get("/players/:id", "MissoesController.jogador");
  Route.post("/claim", "MissoesController.resgatar");
})
  .prefix("api/missions")
  .middleware("auth:api");

// MATCHES (REST)
Route.group(() => {
  Route.get("/", "PartidaController.consultarPartidas");
  Route.get("/:codigo", "PartidaController.detalhesPartida");
}).prefix("api/matches");

Route.group(() => {
  Route.post("/", "PartidaController.importarJson");
  Route.delete("/:id", "PartidaController.excluirPartida");
})
  .prefix("api/matches")
  .middleware("auth:api");
