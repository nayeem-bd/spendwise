# SpendWise

A Monefy-style monthly expense manager for **Web (PWA), Android and iOS** from one Expo codebase. Offline-first: everything is saved on the device and syncs to Supabase when you are online. Currency is BDT (৳) only; the app is in English and বাংলা.

## Features

- Add an expense or income in two taps with the amount keypad and category grid
- Home: spending donut with category icons, month switcher, income / expense / balance
- Transactions grouped by day, swipe a row to **Edit** or **Delete**, search and filter
- Monthly and per-category budgets with alerts at 80% and 100%, and a daily allowance for the rest of the month
- Multiple accounts (Cash, bKash, Bank, …), transfers, recurring transactions
- Reports: monthly trend and category comparison, CSV export
- Shared wallets, receipt photos, daily reminder, PIN / Face ID lock
- Native feel: haptics, iOS-style grouped cards, bottom tabs on phones, navigation rail on tablets, sidebar and two columns on desktop, dark mode

## Stack

Expo (React Native) + Expo Router + TypeScript (strict) · React Native Paper (Material 3) · expo-sqlite + Drizzle ORM (SQLite-WASM on web) · Supabase (Postgres, Auth, RLS, Storage) · custom outbox push / pull sync · Netlify (web) · EAS Build (mobile).

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the full design and [CLAUDE.md](CLAUDE.md) for the code rules.

## Getting started

Needs Node 24 (`.nvmrc`), npm and Docker (for local Supabase).

```bash
nvm use
npm install
npx supabase start          # local backend; prints the URL and anon key
```

Create `.env.local` (never commit it):

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from `npx supabase status`>
```

Then run the app:

```bash
npm run web                 # browser
npx expo run:android        # Android emulator / device
npx expo run:ios            # iOS simulator
```

Sign up on the login screen to create a local account.

> Known issue: the web dev server does not send the COOP/COEP headers on the HTML page, so SQLite-WASM can fail with "SharedArrayBuffer is not defined". Use `npm run build:web` and serve `dist/` with those headers instead (as Netlify does).

## Commands

| Task | Command |
|---|---|
| Typecheck | `npm run typecheck` |
| Unit tests | `npm test` |
| Sync integration tests (local Supabase running) | `npm run test:integration` |
| Backend tests (RLS, triggers) | `npx supabase test db` |
| Reset local DB | `npx supabase db reset` |
| New Supabase migration | `npx supabase migration new <name>` |
| Local SQLite migration after editing `src/lib/db/schema.ts` | `npm run db:generate` |
| Supabase types | `npm run supabase:types` |
| Web build (what Netlify runs) | `npm run build:web` → `dist/` |
| Android preview APK | `npx eas-cli@latest build -p android --profile preview` |

Run `npx tsc --noEmit` and the tests before every commit.

## Project layout

```
app/              Expo Router screens (tabs, transaction editor, accounts, categories, budgets)
src/components/   Shared UI (DonutChart, AmountKeypad, TransactionRow, Section, …)
src/lib/db/       Drizzle schema, migrations, repositories
src/lib/sync/     Outbox push, pull by server_seq, sync engine
src/i18n/         English and Bangla strings
supabase/         Migrations, seed, pgTAP tests
scripts/          Web build (PWA tags + Workbox service worker)
```

## Deploy

- **Web:** Netlify builds from `netlify.toml` on every push. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the site settings; they are inlined at build time. The COOP/COEP headers that SQLite-WASM needs are in `netlify.toml`.
- **Backend:** `npx supabase db push` applies migrations to the cloud project.
- **Android:** EAS preview APK (above). New native modules need a new build; JS-only changes can go out with `eas update`.
- **iPhone:** use the PWA (Safari → Share → Add to Home Screen).
