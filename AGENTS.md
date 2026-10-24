# Penniq — project notes for Codex

Penniq (formerly "Qirsh / قرش") is the user's cash + bank wallet web app in euros. The app lives in `money-tracker/` (React 19, TypeScript strict, Vite 6, Tailwind 4, Motion). Full history, decisions and open tasks are in `PENNIQ-HANDOFF.md` (Arabic) — read it before larger changes.

## Working with the user

- The user writes Levantine Arabic; reply in Arabic.
- They call this a very big project and care a lot about a distinctive, polished design.

## Commands (run inside `money-tracker/`)

- `npm run dev` — dev server on port 3000
- `npm run build` — strict type-check + production build to `dist/`
- `npm run lint` — type-check only
- `npm run pack` — single-file build `publish/penniq.html` for the Codex artifact

## Hard rules

- Never rename the `localStorage` keys in `src/lib/storage.ts` (`my_*`, `qirsh_*`): they hold real user data.
- The current design is **"Mint Edition"** (dark banknote look: guilloché, micro-text border, gold foil, odometer digits; editions olive, paper, indigo, plum, sand, graphite + auto). The user tried a light "Soft Glass" redesign and chose to go back; it is archived in `design-archive/soft-glass/`. Do not reintroduce it unless asked.
- Editions are set with `data-edition` on `<html>` (not `data-theme`, which host pages such as Codex artifacts stamp themselves).
- Every UI string goes through `t()` with ar / de / en entries in `src/i18n/translations.ts`. Arabic is primary and right-to-left.
- Render amounts with `<Money>` / `<Odometer>` (keeps them left-to-right and blurs them in privacy mode).
- No third-party requests except the app's own Supabase project (EU region), and only for accounts and sync. Fonts stay bundled via `@fontsource-variable/*`; add no analytics, CDNs or other outside calls (GDPR).
- Cloud sync: the device (`localStorage`) stays what the UI reads; `src/state/useCloudSync.ts` + `src/lib/cloud.ts` mirror it to Supabase through an outbox. Every change to the transaction list must go through `commit()` in `WalletContext` (that is what records it for upload); settings through `changeSettings()`.
- Database changes go in a new file under `money-tracker/supabase/migrations/` and every table keeps row level security (`user_id = auth.uid()`). Only the publishable key belongs in `.env`; never a secret / service_role key.
- The app must keep working with no Supabase variables (`supabase === null`): that is how the single-file artifact build runs (`--mode artifact`).
- After code changes: `npm run build` must pass, then format with `npx prettier --write "src/**/*.{ts,tsx}"`.

## Supabase

Project `penniq` (ref `ninsqhprdpswdqcthyhc`, org `penniq`, West EU / Ireland, free plan). URL and publishable key are in `money-tracker/.env`. The Supabase connector is authorised for one organisation at a time; if the project is not listed, the user has to reconnect it and pick the `penniq` organisation.

## Published copy

Live site (full app with accounts): https://penniq.netlify.app — Netlify project `penniq` (id `f8f09c09-a6ff-4ce3-8d85-388e64055e94`, team `ericsama0050`). Redeploy with the Netlify connector's deploy-site operation from `money-tracker/`; Netlify builds it per `netlify.toml`, and the Supabase variables live in the Netlify project settings. Supabase Auth has that URL as Site URL and e-mail confirmation turned off.

Codex artifact (older, device-only copy): https://Codex.ai/artifact/HVaCm3fDHLHhMmKotjnkXz — update it with `npm run pack`, then publish `money-tracker/publish/penniq.html` to that URL.
