import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  fetchIndexRows,
  normalizeSymbol,
  type ParsedRow,
} from './psx-parser.ts'

export const ALL_INDEXES = [
  { code: 'KMI30', url: 'https://dps.psx.com.pk/indices/KMI30' },
  { code: 'KSE100', url: 'https://dps.psx.com.pk/indices/KSE100' },
  { code: 'ALLSHR', url: 'https://dps.psx.com.pk/indices/ALLSHR' },
  { code: 'KMIALLSHR', url: 'https://dps.psx.com.pk/indices/KMIALLSHR' },
] as const

export const BENCHMARK_INDEXES = ALL_INDEXES.slice(0, 2)
export const LISTING_INDEXES = ALL_INDEXES.slice(2)

const INSERT_BATCH = 200

export type SyncMode = 'benchmark' | 'listings' | 'full'

export function indexesForMode(mode: SyncMode) {
  if (mode === 'full') return [...ALL_INDEXES]
  if (mode === 'listings') return [...LISTING_INDEXES]
  return [...BENCHMARK_INDEXES]
}

async function syncIndex(
  supabase: SupabaseClient,
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

async function refreshComplianceFlags(supabase: SupabaseClient, shariahSymbols: string[]) {
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

function mergePriceRows(rowSets: ParsedRow[][], shariahSource: ParsedRow[]) {
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

async function upsertPrices(supabase: SupabaseClient, priceRows: Record<string, unknown>[]) {
  for (let i = 0; i < priceRows.length; i += INSERT_BATCH) {
    const batch = priceRows.slice(i, i + INSERT_BATCH)
    const { error: priceError } = await supabase
      .from('stock_prices')
      .upsert(batch, { onConflict: 'symbol' })
    if (priceError) throw new Error(priceError.message)
  }
}

export async function runIndexSync(supabase: SupabaseClient, mode: SyncMode) {
  const indexes = indexesForMode(mode)
  const results: Record<string, number> = {}
  const fetched: ParsedRow[][] = []

  for (const index of indexes) {
    const rows = await fetchIndexRows(index.url)
    await syncIndex(supabase, index.code, rows)
    results[index.code] = rows.length
    fetched.push(rows)
  }

  const shariahSource =
    mode === 'listings'
      ? (fetched.find((_, i) => indexes[i]?.code === 'KMIALLSHR') ?? fetched[1] ?? [])
      : mode === 'full'
        ? (fetched.find((_, i) => indexes[i]?.code === 'KMIALLSHR') ?? [])
        : (fetched[0] ?? [])

  const shariahSymbols = shariahSource.map((r) => normalizeSymbol(r.symbol))
  const priceRows = mergePriceRows(fetched, shariahSource)
  await upsertPrices(supabase, priceRows)
  await refreshComplianceFlags(supabase, shariahSymbols)

  return {
    counts: results,
    shariahCompliant: shariahSymbols.length,
    pricesUpdated: priceRows.length,
  }
}

export async function logSyncRun(
  supabase: SupabaseClient,
  params: {
    triggeredBy: string
    session: 'open' | 'close' | 'manual' | null
    mode: SyncMode
    status: 'running' | 'success' | 'error'
    counts?: Record<string, number>
    error?: string
    runId?: string
  },
) {
  if (params.runId && params.status !== 'running') {
    await supabase
      .from('sync_runs')
      .update({
        status: params.status,
        counts: params.counts ?? null,
        error: params.error ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', params.runId)
    return params.runId
  }

  const { data } = await supabase
    .from('sync_runs')
    .insert({
      triggered_by: params.triggeredBy,
      session: params.session,
      mode: params.mode,
      status: params.status,
      counts: params.counts ?? null,
      error: params.error ?? null,
      finished_at: params.status === 'running' ? null : new Date().toISOString(),
    })
    .select('id')
    .single()

  return data?.id
}
