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

The sync endpoint is `POST /api/sync-indexes` (rewritten to the Netlify function). The service role key is only used server-side in that function.

### Optional: Supabase Edge Function

`supabase/functions/sync-indexes` is kept for reference but **cannot fetch PSX** from Supabase’s network (HTTP 462). Use the Netlify function for production sync.

## Features

- **Transactions** — log buys and sells with searchable symbols
- **Holdings** — computed positions with mark-to-market value
- **Compare** — your weight % vs index weight % with drift
- **Shariah tags** — KMI-30 stocks marked compliant
- **Index sync** — pull KMI-30 & KSE-100 constituents and prices from PSX
- **SIP planner** — whole-share buy suggestions

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard overview |
| `/portfolio` | Holdings table |
| `/transactions` | Add/view trades |
| `/compare` | Index comparison |
| `/indexes` | Sync PSX data |
