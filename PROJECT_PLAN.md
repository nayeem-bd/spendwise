# Project Plan: Monthly Expense Manager (Monefy-style)

Working name: **SpendWise** (rename it if you like)

## 1. Goal

A simple, fast app for tracking monthly income and spending. You add an expense in 2 taps, see where your money goes on a pie chart, and stay within monthly budgets. It runs on **Web, Android and iOS** from **one codebase**, and the hosting and database cost **$0**.

---

## 2. Recommended Tech Stack (all free tier)

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Node 24 LTS** (pinned in `.nvmrc`) | Node 20 is end-of-life; Node 24 is the current LTS (section 2.2) |
| Language | **TypeScript (strict)** | Types catch money and sync bugs early (section 2.1) |
| App (Web + Android + iOS 27) | **Expo (React Native) + TypeScript** | One codebase builds a native app and a website (`expo export --platform web`) |
| Routing | Expo Router | File-based routing that works the same on web and mobile |
| UI | React Native Paper or Tamagui | Ready-made components that work on all platforms |
| Charts | Victory Native / react-native-gifted-charts | Pie and bar charts on every platform |
| State / data fetching | Zustand + TanStack Query | Light and simple, with caching |
| Local DB (offline) | **expo-sqlite + Drizzle ORM** (SQLite on mobile, SQLite-WASM on web) | The app reads and writes locally first, so it works with no internet |
| Sync | **Custom outbox + pull sync** (fully free); option: PowerSync | Syncs local changes to Supabase when back online (see section 5.1) |
| Network detection | @react-native-community/netinfo | Starts a sync when the device reconnects |
| Backend + Database | **Supabase** (Postgres + Auth + Row Level Security) | Free tier, no server code to write, built-in auth |
| Web hosting | **Vercel** or **Cloudflare Pages** | Free static hosting, auto-deploys from GitHub |
| Mobile builds | **EAS Build** (Expo) | Free tier gives a limited number of cloud builds per month |
| Package manager | **npm** (`npx expo install` for Expo packages) | Comes with Node, the Expo default, auto-detected by EAS and Vercel |
| Code / CI | GitHub + GitHub Actions | Free |

**Decision: React Native (Expo), not Flutter.**
| | React Native (Expo) | Flutter |
|---|---|---|
| Web quality | ✅ Real HTML: fast load, SEO, feels like a normal website | ⚠️ Canvas rendering, ~2 MB+ first load |
| Language | TypeScript (reusable for any web work) | Dart (used almost only for Flutter) |
| Over-the-air updates | ✅ `eas update` (free) | ❌ No free built-in option |
| UI and animations | Good | Smoother, looks the same everywhere |

Web matters for this app, so Expo is the safer choice.

### 2.1 Language: TypeScript
- `"strict": true` in `tsconfig.json`. No `any` without a comment explaining why.
- **Branded money type**, so taka and poisha can't be mixed up:
  ```ts
  type Poisha = number & { __brand: 'poisha' };
  const toPoisha = (taka: number) => Math.round(taka * 100) as Poisha;
  formatBDT(250)            // ❌ compile error
  formatBDT(toPoisha(250))  // ✅
  ```
- Supabase DB types are generated with `npx supabase gen types typescript --local > src/lib/database.types.ts`.
- The local schema (Drizzle) and the sync payloads are typed, so renaming a column shows every place that breaks.
- Run `npx tsc --noEmit` and the tests before every commit.

### 2.2 Node.js Version: 24 LTS
Node 20 (currently installed: v20.19.5) reached end-of-life in April 2026. Upgrade with nvm:
```bash
nvm install 24
nvm alias default 24
```
Pin the same version everywhere:
| Where | Setting |
|---|---|
| Project | `.nvmrc` containing `24` |
| package.json | `"engines": { "node": ">=24 <25" }` |
| Vercel | Project Settings → Node.js Version → 24.x |
| EAS | `eas.json` → `"build": { "base": { "node": "24" } }` |

Node 26 becomes LTS around late October 2026. Move to it once the Expo SDK officially supports it.

---

## 3. Features

### MVP (Phase 1)
- **Offline-first**: add, edit and delete with no internet; changes sync automatically when the device is online again
- Sync status indicator (✓ synced / ⟳ syncing / ⚠ offline, N changes pending)
- Sign up and log in (email/password, Google login optional) using Supabase Auth
- Add, edit and delete **expenses** and **income**: amount, category, date, note, account
- **Monefy-style home screen**: a pie chart of this month's spending with category icons around it and big **+ / −** buttons
- Default categories (Food, Transport, Rent, Bills, Shopping, Health, Entertainment, Other) plus custom categories with your own icon and colour
- **Month switcher** (‹ Oct 2026 ›) with totals: Income, Expense, Balance
- Transaction list grouped by day
- **Currency: BDT (৳) only.** There is no currency setting; amounts are shown as `৳1,25,000` with lakh/crore grouping (see section 6.1)
- Dark and light mode

### Phase 2
- **Monthly budgets** per category, with progress bars and alerts at 80% and 100%
- Multiple **accounts/wallets** (Cash, Bank, bKash, Nagad, Rocket, Card) and transfers between them
- **Recurring transactions** (rent, subscriptions)
- Reports: monthly trend bar chart and a category comparison with the previous month
- Search and filter (by date range, category, amount)
- Background sync (runs even when the app is closed) via expo-background-task
- Export to CSV

### Phase 3 (nice to have)
- Shared wallet for a family or partner
- Receipt photo attachments (Supabase Storage, 1 GB free)
- Daily reminder notification ("Did you log today's spending?")
- PIN or fingerprint lock
- PWA install for web (add to home screen)
- Multi-language support (English / বাংলা)

---

## 4. Database Design (Supabase / Postgres)

```sql
-- profiles: one row per user (linked to auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  month_start_day int default 1,       -- e.g. a salary cycle that starts on the 25th
  created_at timestamptz default now()
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,                   -- Cash, Bank, bKash, Nagad, Rocket
  initial_balance numeric(14,2) default 0,
  icon text, color text,
  archived boolean default false,
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  type text not null check (type in ('expense','income')),
  icon text, color text,
  sort_order int default 0,
  archived boolean default false
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  account_id uuid references accounts on delete set null,
  category_id uuid references categories on delete set null,
  type text not null check (type in ('expense','income','transfer')),
  amount numeric(14,2) not null check (amount > 0),
  to_account_id uuid references accounts,   -- only for transfers
  note text,
  occurred_on date not null default current_date,
  recurring_id uuid,                        -- link to recurring rule (phase 2)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,                   -- soft delete, needed for offline sync
  server_seq bigint                         -- set by server trigger, used for pull sync
);
create index on transactions (user_id, occurred_on);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  category_id uuid references categories on delete cascade,  -- null = whole month
  month date not null,                      -- first day of the month
  amount numeric(14,2) not null,
  unique (user_id, category_id, month)
);

create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  template jsonb not null,                  -- amount, category, account, note
  frequency text check (frequency in ('daily','weekly','monthly','yearly')),
  next_run date not null,
  active boolean default true
);
```

**Sync columns (add to EVERY synced table: accounts, categories, transactions, budgets, recurring_rules):**
```sql
-- one global sequence: a server-side counter that is immune to device clock errors
create sequence sync_seq;

create or replace function bump_sync() returns trigger as $$
begin
  new.server_seq := nextval('sync_seq');
  return new;
end $$ language plpgsql;

create trigger trg_sync before insert or update on transactions
  for each row execute function bump_sync();
create index on transactions (user_id, server_seq);
-- repeat the trigger and index for the other tables
```
- `id` is a **UUID generated on the device**, so rows created offline never clash.
- `updated_at` is set by the device when the user edits a row, and is used for conflict resolution.
- `deleted_at` means the row is never hard-deleted, so deletes can sync to other devices too.

**Security:** turn on **Row Level Security** on every table and add a policy like this:
```sql
alter table transactions enable row level security;
create policy "own rows" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
**Monthly summary**: use a Postgres view or RPC function, for example `month_summary(p_month date)`, which returns totals per category. The pie chart then needs only one query.

**Seed data**: a trigger on `auth.users` insert creates the profile, a "Cash" account and the default categories.

---

## 5. Architecture

```
 ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
 │  Web (PWA)    │   │  Android app  │   │   iOS app     │
 │ Vercel/CF     │   │  (EAS build)  │   │  (EAS build)  │
 └──────┬────────┘   └──────┬────────┘   └──────┬────────┘
        └────────── same Expo codebase ─────────┘
                           │
                 Local DB (SQLite / IndexedDB)  ← offline-first
                           │ sync
                           ▼
              ┌─────────────────────────────┐
              │ Supabase (free)             │
              │  • Auth                     │
              │  • Postgres + RLS           │
              │  • Storage (receipts)       │
              │  • Edge Function / pg_cron  │ ← recurring transactions
              └─────────────────────────────┘
```

---

### 5.1 Offline → Online Sync Design

**Principle:** the UI **only ever reads from and writes to the local SQLite DB**. A separate sync engine moves data between the local DB and Supabase in the background. The app therefore feels instant and works on airplane mode.

```
 User taps "Save"
      │
      ▼
 ┌──────────────────────────────┐
 │ Local SQLite (one transaction)│
 │  1. upsert row                │
 │  2. insert into outbox        │
 └──────────────┬───────────────┘
                │  UI updates immediately
                ▼
        Sync engine runs when:
        • app opens / comes to foreground
        • network reconnects (NetInfo)
        • 2 s after any local write (debounced)
        • pull-to-refresh
        • background task (~every 15 min)
                │
      ┌─────────┴─────────┐
      ▼                   ▼
   PUSH                 PULL
 outbox → RPC        rows where server_seq > last_seq
 push_changes()      → upsert into local DB
 → delete sent       → save new last_seq
   outbox rows
```

**Local-only tables (on the device):**
```sql
create table outbox (
  id integer primary key autoincrement,
  table_name text not null,
  row_id text not null,
  op text not null,              -- 'upsert' | 'delete'
  payload text not null,         -- JSON of the full row
  created_at integer not null,
  attempts integer default 0
);
create table sync_state (
  table_name text primary key,
  last_seq integer default 0     -- highest server_seq pulled so far
);
```

**Push** (the device sends its changes):
1. Read up to 100 rows from `outbox`, oldest first, and collapse multiple edits of the same row into the latest one.
2. Call the Supabase RPC `push_changes(changes jsonb)`. One call, one transaction, so either everything is saved or nothing is.
3. On success, delete those outbox rows. On failure, increase `attempts` and retry with exponential backoff (5 s, 30 s, 2 min, …).

**Pull** (the device fetches changes from other devices):
1. For each table: `select * where server_seq > last_seq order by server_seq limit 500`.
2. Upsert the results into local SQLite and skip any row that still has a pending outbox entry, so local edits are not overwritten.
3. Save the new `last_seq`, and repeat until fewer than 500 rows come back.
4. Always **push before pull**.

**Conflict rule: Last-Write-Wins per row** (inside `push_changes`):
```sql
insert into transactions (...) values (...)
on conflict (id) do update set ...
where transactions.updated_at <= excluded.updated_at   -- newer edit wins
  and transactions.user_id = auth.uid();
```
A personal expense app rarely edits the same row on two devices at once, so last-write-wins is simple and good enough. Deletes win as well, because `deleted_at` is just another field update.

**Rules that keep sync simple:**
- **Never store balances or totals.** Always compute them from transactions, so there are no conflicting "balance" numbers.
- Money is stored as **integer poisha (৳1 = 100 poisha)** locally.
- Default categories are created **on the device** with fixed UUIDs (the same on every device), so they never duplicate.
- **Logout** wipes the local DB and outbox (after warning the user if unsynced changes exist).
- **New device or reinstall**: `last_seq = 0`, so the first pull downloads everything.
- **Offline login**: the Supabase session is kept in SecureStore. If the token has expired while offline, the user keeps working locally, and the token refreshes before the next sync.
- Schema changes: local Drizzle migrations plus a `schema_version` check. If the app is too old for the server, ask the user to update before syncing.

**Web offline:**
- Use expo-sqlite web (SQLite-WASM, stored in OPFS). This needs the `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers, which you set in `vercel.json` or `_headers`.
- Add a service worker (Workbox) so the PWA loads with no internet.
- If WASM SQLite causes problems on some browser, you can swap in IndexedDB (via Dexie) behind the same repository interface.

**Alternative: PowerSync** (managed sync built for Supabase, free tier available). It handles the sync engine for you, at the cost of another service and the limits of its free plan. The custom design above is roughly 300–500 lines of code, has no extra service, and is free forever. **Recommendation: build it custom.** The data model is simple and single-user.

**Sync test checklist:**
- [ ] Add 10 expenses on airplane mode, go online, and check that all 10 reach Supabase
- [ ] Edit the same transaction on 2 devices while offline, sync both, and check that the newer edit wins
- [ ] Delete a transaction on phone A and check that it disappears on phone B
- [ ] Kill the app in the middle of a sync, reopen it, and check for no duplicates or lost data
- [ ] Reinstall the app and check that the full history downloads
- [ ] Change the device clock wrongly and check that pull still works (it uses `server_seq`)

---

## 6. Folder Structure

```
spendwise/
├── app/                      # Expo Router screens
│   ├── (auth)/login.tsx
│   ├── (auth)/signup.tsx
│   ├── (tabs)/index.tsx      # Home: pie chart + month switcher
│   ├── (tabs)/transactions.tsx
│   ├── (tabs)/budgets.tsx
│   ├── (tabs)/reports.tsx
│   ├── (tabs)/settings.tsx
│   └── transaction/[id].tsx  # Add / edit
├── src/
│   ├── components/           # PieChart, AmountKeypad, CategoryGrid, MonthSwitcher
│   ├── features/             # transactions/, budgets/, categories/ (hooks + api)
│   ├── lib/supabase.ts
│   ├── lib/db/               # Drizzle schema, migrations, repositories
│   ├── lib/sync/             # outbox, push.ts, pull.ts, syncEngine.ts, useSyncStatus.ts
│   ├── store/                # Zustand stores
│   └── utils/                # money formatting, date helpers
├── supabase/                 # BACKEND (same repo)
│   ├── migrations/           # SQL: tables, RLS, triggers, push_changes RPC
│   ├── functions/            # Edge Functions (recurring transactions)
│   └── seed.sql
├── .env                      # Supabase URL + anon key (in .gitignore)
├── .nvmrc                    # 24
├── CLAUDE.md                 # rules for Claude Code (section 12)
├── app.json / eas.json
└── package.json
```

**Frontend and backend live in one repo.** There's no separate backend server, because Supabase is the backend. The repo holds the SQL migrations and Edge Functions next to the app code.

| Part | Runs on | Deploy |
|---|---|---|
| Frontend (web) | Vercel / Cloudflare Pages | Auto on `git push` |
| Frontend (mobile) | Phones | `eas build` / `eas update` |
| Database, RLS, RPC | Supabase | `npx supabase db push` |
| Edge Functions | Supabase | `npx supabase functions deploy` |

Run the whole backend locally with `npx supabase init` and `npx supabase start` (this needs Docker), so you can test migrations and sync before pushing to the free cloud project. Split into a monorepo (`apps/mobile`, `apps/admin`, `packages/shared`) only if you later add an admin dashboard or your own API server.

**Money tip:** handle amounts as **integers in poisha** (৳1 = 100 poisha) in app code, or as `numeric` in Postgres. Never use JS floating-point maths for money.

### 6.1 BDT Formatting

The app uses a single currency, **BDT (৳)**, so there are no exchange rates and no currency column.

- **Grouping:** use the South Asian lakh/crore style: `৳1,25,000`, `৳1,00,00,000` (not `125,000`).
- **Decimals:** hidden by default (`৳250`); shown only when they are not zero (`৳250.50`).
- **Keypad:** whole taka by default, with an optional `.` key for poisha.
- **Bangla digits (Phase 3):** `৳১,২৫,০০০` when the app language is বাংলা.
- **Large amounts on charts:** `৳1.2L`, `৳3.5Cr`.

```ts
// src/utils/money.ts — the only place amounts are formatted
export function formatBDT(poisha: number, opts: { bangla?: boolean } = {}) {
  const taka = poisha / 100;
  const hasFraction = poisha % 100 !== 0;
  const n = new Intl.NumberFormat(opts.bangla ? 'bn-BD' : 'en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(taka);                       // en-IN gives lakh grouping: 1,25,000
  return `৳${n}`;
}
```
Add unit tests for: `0`, `৳50`, `৳1,25,000`, `৳1,00,00,000`, `৳250.50`, and negative balances (`-৳500`).

**Default BD-friendly categories:** Food & Groceries, Transport (Rickshaw/CNG/Bus/Uber/Pathao), House Rent, Utility Bills (Electricity/Gas/Water/Internet), Mobile Recharge, Shopping, Health, Education, Family Support, Entertainment, Other.
**Income categories:** Salary, Business, Freelance, Gift, Other.
**Default accounts:** Cash, bKash, Bank.

---

## 7. Timeline (for one developer, part-time)

| Week | Work |
|---|---|
| 1 | Set up Expo + TypeScript, Supabase project, migrations (with sync columns), RLS, auth screens, **local SQLite + Drizzle setup** |
| 2 | Categories + accounts CRUD (local DB + outbox), seed defaults, Add Transaction screen with amount keypad |
| 3 | **Sync engine** (push/pull RPC, triggers, status badge) + home screen: pie chart, month switcher, totals, transaction list |
| 4 | Sync tests (checklist in section 5.1), settings, PWA offline, **deploy web to Vercel**, Android preview APK (**MVP done**) |
| 5–6 | Budgets, multiple accounts, transfers, recurring transactions |
| 7 | Reports, search/filter, CSV export |
| 8 | Background sync, more testing, store submission (optional) |

---

## 8. Free Deployment Steps

1. **Supabase**: create a project at supabase.com, run the migrations (`supabase db push`), and copy the URL and anon key.
2. **Env vars**: set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The anon key is safe to ship because RLS protects the data.
3. **Web**: run `npx expo export --platform web` to get a `dist/` folder. Connect the GitHub repo to Vercel or Cloudflare Pages (build command `npx expo export -p web`, output `dist`). Every push then auto-deploys.
4. **Android**: `eas build -p android --profile preview` produces an **APK you can share for free** (by link or Google Drive).
5. **iOS**: for testing, use the Simulator or a development build. TestFlight and the App Store need a paid Apple account (see section 8.1).
6. **Updates**: `eas update` pushes JS changes to installed apps without rebuilding (free tier).

### 8.1 iOS 27 App

The same Expo codebase builds for iOS, so there's no separate project.

**Versions**
- Use the **latest Expo SDK**, and check its changelog for iOS 27 and current-Xcode support.
- Install the **latest Xcode** from the Mac App Store. Apple requires App Store uploads to be built with a recent Xcode and iOS SDK; check Apple's developer news for the exact requirement.
- In `eas.json`, set `"ios": { "image": "latest" }` so cloud builds use the newest Xcode.

**Testing (free)**
| Option | Notes |
|---|---|
| iOS Simulator | `npx expo run:ios`, needs Xcode |
| Expo Go | Fast, but can't run custom native modules |
| Development build with a free Apple ID | Installs on your own iPhone; expires after 7 days, then rebuild |

**Distribution:** TestFlight and the App Store need the **Apple Developer Program ($99/year)**; use `eas build -p ios`, then `eas submit -p ios`. Without the paid account, iPhone users can use the **PWA**: Safari → Share → Add to Home Screen. It works offline.

**iOS-specific items**
- **Face ID lock**: `expo-local-authentication`, plus `NSFaceIDUsageDescription` in `app.json`
- **Session storage**: `expo-secure-store` (iOS Keychain) for the Supabase session
- **Background sync**: `expo-background-task`. iOS decides when it runs, so syncing on app open and on reconnect stays the main path
- **Privacy manifest**: `ios.privacyManifests` in `app.json`, which Apple requires
- **Sign in with Apple**: **required** if you offer Google login (Supabase supports it for free)
- **App icon**: light, dark and tinted variants; splash screen
- **Phase 3**: home-screen widget (this month's spending) and a Siri/Shortcuts "Add expense" action via `expo-apple-targets`

---

## 9. Cost Reality Check

| Item | Cost |
|---|---|
| Supabase (500 MB DB, 50k monthly users, 1 GB storage) | **Free** |
| Vercel / Cloudflare Pages hosting | **Free** |
| EAS Build / Update (limited monthly quota) | **Free** |
| Android APK shared directly | **Free** |
| Google Play Store listing | $25 one-time (optional) |
| Apple App Store | $99/year (optional) |
| Custom domain | ~$10/year (optional; a `*.vercel.app` URL is free) |

**Free-tier caveat:** Supabase **pauses free projects after about 1 week of no activity**. You can resume it with one click in the dashboard. A small GitHub Actions cron job that pings the API every few days keeps it awake. Free-tier limits change, so check them before you launch.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Supabase free project paused | Keep-alive cron job; weekly backups with `pg_dump` via GitHub Actions |
| Offline sync conflicts | Last-write-wins per row via `updated_at`; soft deletes; local edits never overwritten by pull |
| Device clock wrong | Pull uses server-assigned `server_seq`, not timestamps |
| Data lost on logout | Warn the user if the outbox is not empty; force a sync first |
| Chart libraries behave differently on web and mobile | Test on both early (week 3); fall back to an SVG-based chart |
| Data leaks between users | RLS on every table; test with 2 accounts |
| Scope creep | Ship the MVP (week 4) before adding Phase 2 |

---

## 11. Next Steps
1. ~~Confirm the stack~~: Expo + TypeScript + Supabase, BDT only, Node 24 ✅
2. Upgrade Node to 24 (section 2.2) and install the latest Xcode.
3. Create a GitHub repo and a free Supabase project.
4. Open this folder in Claude Code and start with the Week 1 prompt (section 12).

---

## 12. Building with Claude Code

### CLAUDE.md rules
Ask Claude Code to run `/init`, then add these rules to the generated `CLAUDE.md`:
```
- Node 24 LTS (see .nvmrc). Run `nvm use` before npm commands.
- TypeScript strict mode. No `any` without a comment explaining why.
- UI reads and writes ONLY the local SQLite DB. Never call Supabase from screens; only src/lib/sync talks to Supabase.
- Every local write = row upsert + outbox insert in one SQLite transaction.
- IDs are UUIDs generated on the device. Use soft deletes (deleted_at), never hard deletes.
- Money is always the `Poisha` type (integer). Format only with formatBDT(). Currency is BDT only.
- Never store balances or totals; compute them from transactions.
- Every new Supabase table: RLS enabled + "own rows" policy + sync trigger (server_seq).
- Run `npx tsc --noEmit` and the tests before every commit.
- Never commit .env or keys.
```

### Prompts, one phase per session
**Week 1:**
```
Read PROJECT_PLAN.md. Scaffold an Expo + TypeScript app with Expo Router following section 6, with Node 24 pinned. Set up Supabase migrations from section 4 (include sync columns, triggers, RLS) and local SQLite + Drizzle. Then run /init to create CLAUDE.md and add the rules from section 12.
```
**Week 2:**
```
Build categories, accounts and the Add Transaction screen. All writes go to local SQLite plus the outbox, per section 5.1. Never call Supabase from screens. Add formatBDT() with unit tests from section 6.1.
```
**Week 3:**
```
Implement the sync engine from section 5.1: the push_changes RPC, pull by server_seq, triggers, and a sync status badge. Then build the home screen with the pie chart and month switcher.
```
**Week 4:**
```
Write tests for the sync checklist in section 5.1. Add PWA offline support and the COOP/COEP headers, and deploy the web app to Vercel.
```
**iOS:**
```
Configure the Expo app for iOS 27 per section 8.1: latest Expo SDK, eas.json with the latest image, Face ID lock, SecureStore session, privacy manifest, and Sign in with Apple via Supabase. Make sure npx expo run:ios works in the simulator.
```

### Tips
- Make a git commit after each step works, so you can always roll back.
- Test sync on a real phone in airplane mode, not just on the web.
- Run `formatBDT()` tests on a phone too, because number formatting on Hermes can differ from the browser.
