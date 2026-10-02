# SpendWise

Monefy-style monthly expense manager for **Web + Android + iOS 27** from one codebase.
Full plan: @PROJECT_PLAN.md (read the relevant section before starting a phase).

## Stack
- Expo (React Native) + Expo Router + **TypeScript strict**
- Local DB: expo-sqlite + Drizzle ORM (SQLite-WASM on web)
- Backend: Supabase (Postgres + Auth + RLS), code lives in `supabase/` in this repo
- Sync: custom outbox push + pull by `server_seq` (PROJECT_PLAN.md section 5.1)
- Hosting: Vercel (web), EAS Build (mobile). Everything on free tiers.
- Node 24 LTS (see `.nvmrc`). Run `nvm use` before npm commands.

## Rules
- UI reads and writes ONLY the local SQLite DB. Never call Supabase from screens; only `src/lib/sync/` talks to Supabase.
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

## Commands (fill in after scaffolding)
- Dev: `npx expo start`
- iOS simulator: `npx expo run:ios`
- Web build: `npx expo export -p web`
- Local backend: `npx supabase start`
- DB push: `npx supabase db push`
- Types: `npx supabase gen types typescript --local > src/lib/database.types.ts`
