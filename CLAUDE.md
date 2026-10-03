# SpendWise

Monefy-style monthly expense manager for **Web + Android + iOS 27** from one codebase.
Full plan: @PROJECT_PLAN.md (read the relevant section before starting a phase).

## Stack
- Expo (React Native) + Expo Router + **TypeScript strict**
- Local DB: expo-sqlite + Drizzle ORM (SQLite-WASM on web)
- Backend: Supabase (Postgres + Auth + RLS), code lives in `supabase/` in this repo
- Sync: custom outbox push + pull by `server_seq` (PROJECT_PLAN.md section 5.1)
- Hosting: Netlify (web, config in `netlify.toml`), EAS Build (mobile). Everything on free tiers.
- Node 24 LTS (see `.nvmrc`). Run `nvm use` before npm commands.
- Package manager: **npm only** (commit `package-lock.json`; never use yarn/pnpm). Add Expo/RN packages with `npx expo install <pkg>` so versions match the SDK.

## Rules
- UI reads and writes ONLY the local SQLite DB. Never call Supabase from screens; only `src/lib/sync/` and `src/lib/auth/` talk to Supabase.
- Every local write = row upsert + outbox insert in ONE SQLite transaction.
- IDs are UUIDs generated on the device. Soft deletes only (`deleted_at`), never hard deletes.
- Money is always the `Poisha` branded type (integer, ৳1 = 100 poisha). Format only with `formatBDT()`. Currency is **BDT only**.
- Never store balances or totals; compute them from transactions.
- Every new Supabase table: RLS enabled + "own rows" policy + `server_seq` sync trigger + `updated_at`/`deleted_at` columns.
- No `any` without a comment explaining why.
- Never commit `.env` or keys. Only `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` go in the client.

## Workflow
- Work one phase at a time (PROJECT_PLAN.md section 7 / section 12 prompts).
- Before every commit: `npx tsc --noEmit` and tests must pass.
- Commit after each working step.
- Test sync on a real device in airplane mode; test `formatBDT()` on Hermes too.

## Commands
Run `nvm use` first. Packages come from npmjs.org via the project `.npmrc` (the global npmrc points at a company registry that blocks them).
- Dev server: `npx expo start` (web: `npm run web`)
- iOS simulator: `npx expo run:ios` · Android: `npx expo run:android`
- Typecheck: `npm run typecheck` (`npx tsc --noEmit`)
- Unit tests: `npm test` (jest-expo)
- Sync integration tests against local Supabase: `npm run test:integration` (needs `npx supabase start`; plain-Node jest config because jest-expo stubs `fetch`)
- Health check: `npx expo-doctor`
- Web build (what Netlify runs): `npm run build:web` → `dist/` (expo export + PWA tags + Workbox service worker)
- Android preview APK: `npx eas-cli@latest build -p android --profile preview` (env vars from the EAS `preview` environment)
- Local backend: `npx supabase start` (needs Docker) · stop: `npx supabase stop`
- Reset local DB (re-run migrations + seed): `npx supabase db reset`
- Backend tests (pgTAP, RLS + triggers): `npx supabase test db`
- New Supabase migration: `npx supabase migration new <name>`
- Push migrations to cloud: `npx supabase db push`
- Supabase types: `npm run supabase:types`
- Local SQLite migration after editing `src/lib/db/schema.ts`: `npm run db:generate`

## Layout notes
- Routes in `app/` (Expo Router). Local DB in `src/lib/db/` (`schema.ts`, generated `migrations/`, `client.ts`, `DatabaseGate.tsx`).
- Use `getDb()` from `src/lib/db/client.ts`; `<DatabaseGate>` in `app/_layout.tsx` opens the DB (async, required on web) and runs migrations first.
- Local schema mirrors Supabase but money is integer poisha, timestamps ISO text, no local FKs. Server money is `numeric(14,2)` taka; the sync layer converts.
- Sync lives in `src/lib/sync/`: `push.ts` / `pull.ts` (pure logic over a `SyncBackend`), `supabaseBackend.ts`, `syncEngine.ts` (triggers, backoff, status store). The server side is the `push_changes` RPC (LWW on `updated_at`, returns current rows, per-user advisory lock). Any code that writes synced rows outside `write.ts` must call `notifyChanged()`.
- Generated or per-period rows use deterministic UUIDv5 ids so devices never duplicate them: budgets `uuidv5('budget:<category|total>:<YYYY-MM>', user_id)`, recurring occurrences `uuidv5('occurrence:<date>', rule_id)` (created on the device by `materializeRecurring`, not by a server job; stamped with the occurrence date so user edits/deletes win LWW).
- Default accounts/categories use deterministic ids `uuidv5(user_id, '<kind>:<key>')` (see `handle_new_user()` in `supabase/migrations/`). Device-side seeding must use the same keys.
