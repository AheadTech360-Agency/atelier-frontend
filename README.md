# Atelier frontend

React 19, Vite, TypeScript, TanStack Router and Query, Tailwind v4. Talks to the Rust backend (`/api/v1`) for all data, and to Supabase only for sign-in, live updates and direct image uploads.

## Run locally

```sh
npm install
cp .env.example .env   # VITE_SUPABASE_ANON_KEY from `npx supabase status` in atelier-backend
npm run dev            # http://localhost:5173
```

The backend must be running on `VITE_API_URL`. There is no sign-up page: an admin creates your login (see the backend README for the first admin).

## Screens

| Route | What |
|---|---|
| `/` | Overview: what's waiting on the team, today's runs, client health, LLM usage per bot and client |
| `/inbox` | Human Required: approve, edit and approve, send back, reject, resolve. `j` and `k` move through the queue |
| `/clients/:id` | Per client: logins and APIs, sites, images, brand and claims, bot settings, findings, content, outreach |
| `/bots` | Bot health, Rakazo webhook, Run now, prospect reviews |
| `/tasks` | Handoffs between bots, and tasks you assign |
| `/reports` | Weekly summaries, AI visibility, audits. Save as PDF |
| `/settings` | My account (change your password), team, Slack notifications, bot API keys, audit log |

## Types

`src/api-types` is generated from the Rust backend with ts-rs. Don't edit those files by hand.

```sh
npm run sync-types    # regenerate from ../atelier-backend (or ATELIER_BACKEND_DIR)
npm run check-types   # fail if the committed types don't match the backend
```

Both build only the backend's `export_bindings` tests, with one job and no debug info, so they fit on an 8 GB machine. `sync-types` clears the folder first, so types removed from the backend disappear here too. Run `check-types` before pushing whenever the backend's API changed, and commit the regenerated files.

## Deploy

`npm run build` and host `dist/` on any static host (Cloudflare Pages, Vercel). Set the three `VITE_` variables at build time, and add the site's origin to the backend's `CORS_ORIGINS`. Add an SPA fallback so all routes serve `index.html`.
