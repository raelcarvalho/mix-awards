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

Route.get("/", async () => {
  return { hello: "world" };
});

// STATIC CONTROLLER
Route.get("/index", ({ response }) => {
  response.stream(fs.createReadStream(Application.publicPath("index.html")));
});

Route.get("/login-html", ({ response }) => {
  response.stream(fs.createReadStream(Application.publicPath("login.html")));
});

Route.get("/cadastrar-html", ({ response }) => {
  response.stream(
    fs.createReadStream(Application.publicPath("cadastrar.html"))
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

Route.get("/uploads/stickers/:file", ({ params, response }) => {
  const abs = Application.publicPath(`uploads/stickers/${params.file}`);
  if (!fs.existsSync(abs)) {
    return response.status(404).send("Arquivo não encontrado");
  }
  // dica: já define o content-type; download também funciona
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
  Route.get("/album", "AlbumController.meuAlbum");
  Route.post("/album/pacotes/abrir", "AlbumController.abrirPacote");
  Route.post("/album/figurinhas", "AlbumController.cadastrarFigurinha");
}).middleware("auth");

// ALBUM STICKERS
Route.group(() => {
  Route.post("/album/stickers", "AlbumStickersController.criarAlbumSticker");
  Route.get("/album/stickers", "AlbumStickersController.meuAlbum");
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
  Route.get(
    "/shop/listar-capsulas-fechadas",
    "ShopController.listarCapsulasFechadas"
  );
}).middleware("auth");

// LOGIN E CADASTRO
Route.group(() => {
  Route.post("/login", "LoginController.login");
});

Route.post("/cadastrar", "LoginController.cadastrar");
Route.post("/recuperar-senha", "LoginController.recuperarSenha");
Route.post("/alterar-senha", "LoginController.alterarSenha").middleware("auth:api");

Route.group(() => {
  Route.post("/logout", async ({ auth, response }) => {
    try {
      await auth.use("api").revoke();
    } catch {}
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

// PARTIDA CONTROLLER
Route.group(() => {
  Route.get("/listar", "PartidaController.consultarPartidas");
  Route.get("/detalhes/:codigo", "PartidaController.detalhesPartida");
  Route.get("/ranking", "JogadoresController.listar");
}).prefix("api/partida");
