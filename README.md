# Tetovažе Raš — Netlify production

## Stack

- Static site + Admin UI
- Netlify Functions API (`/api/*`)
- Shared store: **Netlify Blobs** in production, `.data/` locally (`USE_LOCAL_DATA=1`)

## Local

```bash
npm install
npm run dev
```

- Site: http://localhost:8888
- Admin: http://localhost:8888/admin/
- Password (local default): `raso-admin-2026`

```bash
npm run test:flow
npm run test:prod
```

## Admin can

- View / delete consultation bookings from shared DB
- Add / delete gallery images (public gallery reads same API)

## Netlify deploy

1. Connect repo to Netlify (publish `.`, functions `netlify/functions`)
2. Environment variables:
   - `ADMIN_PASSWORD` — strong password
   - `ADMIN_TOKEN_SECRET` — long random string
3. Do **not** set `USE_LOCAL_DATA` in production

On first gallery request the portfolio is seeded into the shared index; new uploads go into Blobs.

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/bookings` | public | create reservation |
| GET | `/api/availability?date=` | public | taken times |
| GET/DELETE | `/api/bookings` | admin | list / delete |
| POST | `/api/admin-login` | public | `{password}` → token |
| GET | `/api/gallery` | public | list images |
| POST/DELETE | `/api/gallery` | admin | upload / delete |
| GET | `/api/gallery-file?id=` | public | image binary |
