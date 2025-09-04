/*
|--------------------------------------------------------------------------
| Application middleware
|--------------------------------------------------------------------------
|
| Este arquivo registra middlewares globais e nomeados para todas as requisições HTTP.
|
*/

import Server from "@ioc:Adonis/Core/Server";

/*
|--------------------------------------------------------------------------
| Global middleware
|--------------------------------------------------------------------------
|
| Middlewares globais executados em todas as requisições.
|
*/
Server.middleware.register([
  () => import("@ioc:Adonis/Core/BodyParser"),
  () => import("App/Middleware/SilentAuth"),
]);

/*
|--------------------------------------------------------------------------
| Named middleware
|--------------------------------------------------------------------------
|
| Middlewares com nome, usados por rotas específicas.
|
*/
Server.middleware.registerNamed({
  auth: "App/Middleware/Auth",
  silentAuth: "App/Middleware/SilentAuth",
});
