import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { fetchIndexRows, type ParsedRow } from '../_shared/parse-psx.ts'
import { normalizeSymbol } from '../_shared/symbols.ts'

const BENCHMARK_INDEXES = [
  { code: 'KMI30', url: 'https://dps.psx.com.pk/indices/KMI30' },
  { code: 'KSE100', url: 'https://dps.psx.com.pk/indices/KSE100' },
] as const

const LISTING_INDEXES = [
  { code: 'ALLSHR', url: 'https://dps.psx.com.pk/indices/ALLSHR' },
  { code: 'KMIALLSHR', url: 'https://dps.psx.com.pk/indices/KMIALLSHR' },
] as const

const INSERT_BATCH = 200

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function syncIndex(
  supabase: ReturnType<typeof createClient>,
  code: string,
  rows: ParsedRow[],
) {
  const { data: sync, error: syncError } = await supabase
    .from('index_syncs')
    .insert({ index_code: code })
    .select('id')
    .single()

  if (syncError || !sync) {
    throw new Error(`Failed to create sync for ${code}: ${syncError?.message}`)
  }

  const constituents = rows.map((r) => ({
    sync_id: sync.id,
    symbol: r.symbol,
    name: r.name,
    weight_pct: r.weight_pct,
    price: r.price,
    prev_close: r.prev_close,
    volume: r.volume,
    market_cap_m: r.market_cap_m,
  }))

  for (let i = 0; i < constituents.length; i += INSERT_BATCH) {
    const batch = constituents.slice(i, i + INSERT_BATCH)
    const { error: insertError } = await supabase.from('index_constituents').insert(batch)
    if (insertError) throw new Error(insertError.message)
  }
}

async function refreshComplianceFlags(
  supabase: ReturnType<typeof createClient>,
  shariahSymbols: string[],
) {
  const { error: resetError } = await supabase
    .from('stock_prices')
    .update({ shariah_compliant: false })
    .not('symbol', 'is', null)

  if (resetError) throw new Error(`Compliance reset failed: ${resetError.message}`)

  for (let i = 0; i < shariahSymbols.length; i += INSERT_BATCH) {
    const batch = shariahSymbols.slice(i, i + INSERT_BATCH)
    const { error: markError } = await supabase
      .from('stock_prices')
      .update({ shariah_compliant: true })
      .in('symbol', batch)

    if (markError) throw new Error(`Compliance update failed: ${markError.message}`)
  }
}

function mergePriceRows(
  rowSets: ParsedRow[][],
  shariahSource: ParsedRow[],
): Record<string, unknown>[] {
  const shariahSet = new Set(shariahSource.map((r) => normalizeSymbol(r.symbol)))
  const allRows = new Map<string, ParsedRow>()

  for (const rows of rowSets) {
    for (const row of rows) {
      const symbol = normalizeSymbol(row.symbol)
      allRows.set(symbol, { ...row, symbol })
    }
  }

  return [...allRows.values()].map((r) => ({
    symbol: r.symbol,
    name: r.name,
    price: r.price,
    prev_close: r.prev_close,
    shariah_compliant: shariahSet.has(r.symbol),
    updated_at: new Date().toISOString(),
  }))
}

async function upsertPrices(
  supabase: ReturnType<typeof createClient>,
  priceRows: Record<string, unknown>[],
) {
  for (let i = 0; i < priceRows.length; i += INSERT_BATCH) {
    const batch = priceRows.slice(i, i + INSERT_BATCH)
    const { error: priceError } = await supabase
      .from('stock_prices')
      .upsert(batch, { onConflict: 'symbol' })
    if (priceError) throw new Error(priceError.message)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase environment variables.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let mode: 'benchmark' | 'listings' = 'benchmark'
  if (req.headers.get('Content-Type')?.includes('application/json')) {
    try {
      const body = await req.json()
      if (body?.mode === 'listings') mode = 'listings'
    } catch {
      // empty body is fine for benchmark sync
    }
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: authError,
  } = await supabaseUser.auth.getUser()

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const indexes = mode === 'listings' ? LISTING_INDEXES : BENCHMARK_INDEXES
  const results: Record<string, number> = {}

  try {
    const fetched: ParsedRow[][] = []

    for (const index of indexes) {
      const rows = await fetchIndexRows(index.url)
      await syncIndex(supabase, index.code, rows)
      results[index.code] = rows.length
      fetched.push(rows)
    }

    const shariahSource = mode === 'listings' ? (fetched[1] ?? []) : (fetched[0] ?? [])
    const shariahSymbols = shariahSource.map((r) => normalizeSymbol(r.symbol))
    const priceRows = mergePriceRows(fetched, shariahSource)
    await upsertPrices(supabase, priceRows)
    await refreshComplianceFlags(supabase, shariahSymbols)

    return new Response(
      JSON.stringify({
        ok: true,
        mode,
        counts: results,
        shariahCompliant: shariahSymbols.length,
        pricesUpdated: priceRows.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    console.error('sync-indexes error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
