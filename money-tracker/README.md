# Penniq

**كل قرش بحسابه** — a cash + bank wallet in the currency each user picks. Log income, expenses and transfers, see where the money goes, keep a monthly budget. Arabic (right-to-left) first, with German and English.

The wallet lives in the browser on the user's device (`localStorage`), so the app works offline. With an account (Supabase, EU region) it is also saved online and kept in sync between devices. Without an account — or in a build without the Supabase variables — everything stays on the device and no outside request is made.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 (also reachable from a phone on the same Wi-Fi)
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Type-check, then build the production site into `dist/` |
| `npm run preview` | Serve the built `dist/` on port 4173 |
| `npm run lint` | Type-check only (`tsc --noEmit`, strict) |
| `npm run icons` | Regenerate the PNG app icons in `public/` |
| `npm run pack` | Build one self-contained file `publish/penniq.html` (for hosts that wrap the page, e.g. a Claude artifact) |

## Accounts and sync (Supabase)

1. Copy `.env.example` to `.env` and fill in the project URL and the **publishable** key.
2. Create the tables once by running `supabase/migrations/*.sql` in the project (SQL editor or `supabase db push`).
3. In the Supabase dashboard → Authentication: set **Site URL** (and Redirect URLs) to where the app is hosted. For real users either connect an SMTP provider or turn off *Confirm email* — the built-in mailer only writes to members of the Supabase organisation.

How it works:

- `transactions` holds one row per entry and `user_settings` one row per user (lists, budget, quick amounts). Row level security lets a signed-in user see and change only their own rows.
- The device stays the source the UI reads from. Local changes go into an outbox (`penniq_cloud_outbox`) and upload when there is a connection; on sign-in, on coming back online and when the app returns to the foreground the account's rows are pulled and replace the local ones, with not-yet-uploaded changes laid on top (`src/lib/cloud.ts`, `src/state/useCloudSync.ts`).
- Signing out removes the wallet from the device (it stays in the account). The first sign-in on a device that already has entries asks whether to add them to the account.
- Theme, language and the privacy switch stay per device.
- `npm run pack` builds with `--mode artifact` (`.env.artifact`), which has no Supabase variables: that single file is device-only.

## Deploy

Live at https://penniq.pages.dev (Cloudflare Pages, connected to GitHub `xericll/Penniq`; every push to `main` deploys). Root directory `money-tracker`, build command `npm run build`, output `dist`; headers in `public/_headers`; `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set in the Cloudflare project settings.

On another host:

`npm run build` and upload the `dist/` folder to any static host (Cloudflare Pages, Vercel, GitHub Pages…). Serve it over **HTTPS** so the offline service worker and "Add to Home Screen" work.

## Stack

React 19 · TypeScript (strict) · Vite 6 · Tailwind CSS 4 · Motion · lucide-react. Fonts (Playfair Display, Amiri, Manrope, IBM Plex Sans Arabic, DM Mono) are bundled through `@fontsource/*` and `@fontsource-variable/*`.

## Project map

```
index.html                 pre-paint script: theme, language, privacy before React mounts
public/                    favicon, app icons, manifest.webmanifest, sw.js (offline cache)
scripts/                   make-icons.cjs, pack-single-file.cjs
src/
  main.tsx                 providers + service worker registration
  App.tsx                  shell: tabs (URL hash), sheets, save-failure banner
  index.css                design tokens for the 10 editions + component classes
  types.ts
  lib/                     storage (localStorage keys), ledger (all money maths), supabase (client), cloud (rows, outbox, merge),
                           categories, sources, haptics, confetti, boot
  state/                   WalletContext (transactions + settings), AuthContext (session), useCloudSync (sync engine),
                           ToastContext, PrivacyContext
  theme/ThemeContext.tsx   editions + legacy theme id mapping
  i18n/                    translations.ts (ar/de/en), LanguageContext (money + date formatting)
  hooks/                   useKeyboardViewport, useMediaQuery, useToday
  screens/                 Home, Activity, Insights, Settings, AuthScreen (sign in / sign up / reset), ScreenHeader
  components/
    composer/Composer.tsx  the one sheet for expense / income / transfer
    home/                  BalanceNote, Pockets, PrivacyButton, PulseChips
    nav/Navigation.tsx     bottom dock (phones) + side rail (desktop)
    sheets/                Account, Receipt, Edit, Sources, Balance (correct/opening), Reset, Cloud (adopt / sign out / delete account)
    tx/                    TxRow, describe (how every transaction is named and iconised)
    ui/                    Sheet, Segmented, Keypad, Money (odometer), Engraving, Logo
    ErrorBoundary.tsx, Splash.tsx
supabase/migrations/       database schema (tables, row level security, delete_account)
```

## Rules that must not be broken

- **Never rename the `localStorage` keys** in `src/lib/storage.ts` (including the old `qirsh_*` and `my_*` names). They hold users' real data.
- Balances are always computed from the transaction list (`computeBalances`), never stored as the source of truth.
- Besides the wallet (`cash`, `bank`) there are three more ledgers in the same transaction list: `vault` (money kept aside), `loans` (money lent out, `kind: 'loan'`) and `owed` (money borrowed, `kind: 'borrow'`); each repayment is `kind: 'repayment'` pointing at its debt with `debtId`. Essentials — fixed monthly incomes and costs — are a separate list stored with the settings; adding one creates a normal transaction. The wallet total and all statistics leave them out (`isFlow`, `isWallet` in `src/lib/ledger.ts`).
- Categories are stored as their Arabic label and resolved through aliases in `src/lib/categories.ts`.
- Every user-facing string goes through `t()` in `src/i18n/translations.ts`, in all three languages.
- The wallet has one currency per user (`src/lib/currency.ts`; any ISO 4217 code the browser knows). Changing it only changes the sign shown — nothing is converted. Use `currencySymbol` from `useI18n()` instead of writing a sign, and `setCurrency()` from `useWallet()` to change it.
- Amounts are rendered with `<Money>` / `<Odometer>` so they stay left-to-right inside Arabic text and blur in privacy mode.
