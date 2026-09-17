# Rinde Más Carnes — Frontend

React + Vite. Consume la API Nest del repo `KitiKitiKiti`.

## Ambientes

| Ambiente | `VITE_API_URL` | Base que toca |
| --- | --- | --- |
| Local | `/api/v1` (proxy a `http://127.0.0.1:3000`) | Neon/Docker de Development |
| Vercel Preview | URL absoluta de la API de Preview/Development | Neon Development |
| Vercel Production | URL absoluta de la API de Production | Neon Production |

Nunca apuntes Preview ni local a la API de Production.

## Development

```bash
copy .env.example .env.local
npm install
npm run dev
```

`.env.development` ya define `VITE_API_URL=/api/v1`. Vite proxea `/api` al backend local.

Levantá la API en el otro repo (`npm run start:dev`) antes de usar el mostrador o el admin.

## Production / Vercel

Proyecto Vercel = este frontend (framework Vite).

**Settings → Environment Variables**

| Variable | Production | Preview | Development |
| --- | --- | --- | --- |
| `VITE_API_URL` | `https://<api-prod>/api/v1` | `https://<api-preview-o-dev>/api/v1` | no hace falta (usa el proxy) |

El build **falla** si en producción `VITE_API_URL` falta o es una ruta relativa. Así no se mezcla el frontend real con la API local.

`VITE_*` es pública (queda en el bundle del navegador). Nunca pongas `DATABASE_URL`, `JWT_SECRET` ni otras credenciales en el frontend.

`vercel.json` ya reescribe el SPA a `index.html`.

## Scripts

- `npm run dev` — Development
- `npm run build` — build (exige `VITE_API_URL` absoluta en modo production)
- `npm run preview` — servir el build
