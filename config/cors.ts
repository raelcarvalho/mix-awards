import { CorsConfig } from '@ioc:Adonis/Core/Cors'

const corsConfig: CorsConfig = {
  enabled: true, // <— LIGA o CORS

  // Em dev, permita os front-ends locais (Vite e Next)
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],

  // Inclua PATCH (muita API usa) — HEAD/OPTIONS são tratados automaticamente
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],

  headers: true,        // aceita os headers do preflight
  exposeHeaders: [
    'cache-control',
    'content-language',
    'content-type',
    'expires',
    'last-modified',
    'pragma',
  ],
  credentials: true,    // se você usar cookies/sessão
  maxAge: 90,
}

export default corsConfig
