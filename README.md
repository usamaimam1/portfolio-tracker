# PSX Portfolio Tracker

Track your Pakistan Stock Exchange investments against **KMI-30** and **KSE-100** benchmarks.

## Stack

- **Frontend:** React + Vite + Tailwind CSS → [Netlify](https://www.netlify.com)
- **Backend:** [Supabase](https://supabase.com) (Postgres, Auth, Edge Functions)
- **Index sync:** Supabase Edge Function fetches live data from [PSX DPS](https://dps.psx.com.pk/indices/KMI30)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations in `supabase/migrations/` via SQL Editor or `supabase db push`
3. Enable Email auth under Authentication → Providers
4. Copy your project URL and anon key into `.env.local`

### 2. Deploy the Edge Function

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), link your project, then deploy:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy sync-indexes
```

The function uses `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` automatically — no extra secrets needed.

### 3. Local development

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

To test index sync locally, run the Edge Function alongside the app:

```bash
supabase functions serve sync-indexes --env-file .env.local
```

The app calls `supabase.functions.invoke('sync-indexes')` — no Netlify function or `/api` proxy required.

### 4. Deploy to Netlify

1. Connect this repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

No service role key is needed on Netlify — it stays in Supabase only.

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
