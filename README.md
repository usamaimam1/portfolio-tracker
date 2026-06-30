# PSX Portfolio Tracker

Track your Pakistan Stock Exchange investments against **KMI-30** and **KSE-100** benchmarks.

## Stack

- **Frontend:** React + Vite + Tailwind CSS → [Netlify](https://www.netlify.com)
- **Backend:** [Supabase](https://supabase.com) (Postgres, Auth, Edge Functions)
- **Index sync:** Netlify Function fetches live data from [PSX DPS](https://dps.psx.com.pk/indices/KMI30) (PSX blocks Supabase Edge datacenter IPs with HTTP 462)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations in `supabase/migrations/` via SQL Editor or `supabase db push`
3. Enable Email auth under Authentication → Providers
4. Copy your project URL and anon key into `.env.local`

### 2. Local development

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
# For sync: also add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only)

npm install
```

**App only** (no index sync):

```bash
npm run dev
```

**App + index sync** (Netlify dev proxies `/api` to the function):

```bash
netlify dev
```

### 3. Deploy to Netlify

1. Connect this repo to Netlify
2. Build command: `npm run build` (from `netlify.toml`)
3. Publish directory: `dist`
4. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL` (same project URL)
   - `SUPABASE_SERVICE_ROLE_KEY` (Site settings → Environment variables — **never** prefix with `VITE_`)
   - `CRON_SECRET` — for scheduled open/close sync

The sync endpoint is `POST /api/sync-indexes` (rewritten to the Netlify function). Scheduled jobs run `scheduled-sync-open` (~9:30 PKT) and `scheduled-sync-close` (~3:30 PKT) on weekdays.

### Database migrations

Run all files in `supabase/migrations/` through `009_daily_reports.sql` (006–009 are new).

## Features

- **Custom portfolio bucket** — remainder % split across your holdings outside top N (including off-index); equal or custom weights in Settings
- **Planner** — toggle to include custom bucket in buy plan
- **CSV import** — separate purchase/sale import with idempotency (re-uploading the same report is skipped)
- **Scheduled sync** — KMI30, KSE100, KSE All Share (ALLSHR), KMI All Share at market open/close
- **Daily reports** — downloadable CSV/JSON in Reports tab; open/close snapshots after scheduled sync
- **Transactions** — log buys and sells with searchable symbols
- **Holdings** — computed positions with mark-to-market value
- **Compare** — actual vs preferred target weights with drift
- **Shariah tags** — KMI All Share listings marked compliant
- **Index sync** — manual or scheduled pull from PSX

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard overview |
| `/portfolio` | Holdings table |
| `/transactions` | Manual entry + CSV import |
| `/compare` | Index comparison |
| `/planner` | SIP planner with custom bucket toggle |
| `/settings` | Top N + custom bucket rules |
| `/indexes` | Sync PSX data |
| `/reports` | Downloadable reports + snapshot history |
