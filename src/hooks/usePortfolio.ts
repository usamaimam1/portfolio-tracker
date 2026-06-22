import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { invokeSyncIndexes } from '../lib/sync-indexes'
import {
  buildComparison,
  buildPriceMap,
  buildShariahSymbolSet,
  computeHoldings,
  normalizeSymbol,
  summarizeCompliance,
  summarizePortfolio,
  suggestShareBuys,
} from '../lib/portfolio'
import type {
  BenchmarkIndex,
  ComparisonRow,
  ComplianceSummary,
  IndexConstituent,
  IndexSync,
  PortfolioSummary,
  StockPrice,
  SyncMode,
  Transaction,
} from '../types'

async function loadBenchmarkSymbols(): Promise<Set<string>> {
  const symbols = new Set<string>()

  for (const code of ['KMI30', 'KSE100'] as const) {
    const { data: latestSync } = await supabase
      .from('index_syncs')
      .select('id')
      .eq('index_code', code)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latestSync) continue

    const { data: rows } = await supabase
      .from('index_constituents')
      .select('symbol')
      .eq('sync_id', latestSync.id)

    for (const row of rows ?? []) {
      symbols.add(normalizeSymbol(row.symbol))
    }
  }

  return symbols
}

async function loadIndexSymbols(code: string): Promise<string[]> {
  const { data: latestSync } = await supabase
    .from('index_syncs')
    .select('id')
    .eq('index_code', code)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestSync) return []

  const { data: rows } = await supabase
    .from('index_constituents')
    .select('symbol')
    .eq('sync_id', latestSync.id)

  return (rows ?? []).map((r) => normalizeSymbol(r.symbol))
}

/** KMIALLSHR is the full shariah listing; fall back to KMI-30 if not synced yet. */
async function loadShariahSymbols(): Promise<Set<string>> {
  const kmiAllShr = await loadIndexSymbols('KMIALLSHR')
  if (kmiAllShr.length > 0) return buildShariahSymbolSet(kmiAllShr)

  const kmi30 = await loadIndexSymbols('KMI30')
  return buildShariahSymbolSet(kmi30)
}

async function loadKmi30Constituents(): Promise<IndexConstituent[]> {
  const { data: latestSync } = await supabase
    .from('index_syncs')
    .select('id')
    .eq('index_code', 'KMI30')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestSync) return []

  const { data: rows } = await supabase
    .from('index_constituents')
    .select('*')
    .eq('sync_id', latestSync.id)
    .order('weight_pct', { ascending: false })

  return (rows as IndexConstituent[]) ?? []
}

export function usePortfolio(userId: string | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [prices, setPrices] = useState<StockPrice[]>([])
  const [syncs, setSyncs] = useState<IndexSync[]>([])
  const [constituents, setConstituents] = useState<IndexConstituent[]>([])
  const [kmi30Constituents, setKmi30Constituents] = useState<IndexConstituent[]>([])
  const [benchmarkSymbols, setBenchmarkSymbols] = useState<Set<string>>(new Set())
  const [shariahSymbols, setShariahSymbols] = useState<Set<string>>(new Set())
  const [benchmark, setBenchmark] = useState<BenchmarkIndex>('KMI30')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<SyncMode | null>(null)
  const [error, setError] = useState<string | null>(null)

  const priceMap = useMemo(() => buildPriceMap(prices), [prices])
  const holdings = computeHoldings(transactions, priceMap, shariahSymbols)
  const summary: PortfolioSummary = summarizePortfolio(holdings)
  const compliance: ComplianceSummary = summarizeCompliance(holdings)
  const comparison: ComparisonRow[] = buildComparison(
    constituents,
    holdings,
    priceMap,
    shariahSymbols,
  )
  const kmi30Comparison = useMemo(
    () => buildComparison(kmi30Constituents, holdings, priceMap, shariahSymbols),
    [kmi30Constituents, holdings, priceMap, shariahSymbols],
  )
  const uncoveredHoldings = useMemo(
    () => holdings.filter((h) => !benchmarkSymbols.has(h.symbol)),
    [holdings, benchmarkSymbols],
  )

  const loadBenchmark = useCallback(async (code: BenchmarkIndex) => {
    const { data: latestSync } = await supabase
      .from('index_syncs')
      .select('*')
      .eq('index_code', code)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latestSync) {
      setConstituents([])
      return
    }

    const { data: rows } = await supabase
      .from('index_constituents')
      .select('*')
      .eq('sync_id', latestSync.id)
      .order('weight_pct', { ascending: false })

    setConstituents((rows as IndexConstituent[]) ?? [])
  }, [])

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)

    const [txRes, priceRes, syncRes, kmi30Rows, benchmarkSymbolSet, shariahSymbolSet] =
      await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('trade_date', { ascending: false }),
      supabase.from('stock_prices').select('*'),
      supabase
        .from('index_syncs')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(20),
      loadKmi30Constituents(),
      loadBenchmarkSymbols(),
      loadShariahSymbols(),
    ])

    if (txRes.error) setError(txRes.error.message)
    if (priceRes.error) setError(priceRes.error.message)

    setTransactions((txRes.data as Transaction[]) ?? [])
    setPrices(
      ((priceRes.data as StockPrice[]) ?? []).map((p) => ({
        ...p,
        shariah_compliant: p.shariah_compliant ?? false,
      })),
    )
    setSyncs((syncRes.data as IndexSync[]) ?? [])
    setKmi30Constituents(kmi30Rows)
    setBenchmarkSymbols(benchmarkSymbolSet)
    setShariahSymbols(shariahSymbolSet)
    await loadBenchmark(benchmark)
    setLoading(false)
  }, [userId, benchmark, loadBenchmark])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setBenchmarkIndex = async (code: BenchmarkIndex) => {
    setBenchmark(code)
    await loadBenchmark(code)
  }

  const addTransaction = async (tx: Omit<Transaction, 'id' | 'user_id' | 'created_at'>) => {
    if (!userId) return { error: 'Not signed in' }
    const { error: insertError } = await supabase.from('transactions').insert({
      ...tx,
      user_id: userId,
      symbol: normalizeSymbol(tx.symbol),
    })
    if (!insertError) await refresh()
    return { error: insertError?.message ?? null }
  }

  const deleteTransaction = async (id: string) => {
    const { error: deleteError } = await supabase.from('transactions').delete().eq('id', id)
    if (!deleteError) await refresh()
    return { error: deleteError?.message ?? null }
  }

  const runSync = async (mode: SyncMode) => {
    setSyncing(mode)
    setError(null)
    try {
      const data = await invokeSyncIndexes(mode)
      await refresh()
      return { error: null, ...data }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sync failed'
      setError(message)
      return { error: message }
    } finally {
      setSyncing(null)
    }
  }

  const syncIndexes = () => runSync('benchmark')
  const syncListings = () => runSync('listings')

  const suggestInvest = (amount: number) => suggestShareBuys(amount, kmi30Comparison, true)

  return {
    transactions,
    prices,
    syncs,
    constituents,
    shariahSymbols,
    benchmark,
    holdings,
    summary,
    compliance,
    comparison,
    kmi30Comparison,
    uncoveredHoldings,
    loading,
    syncing,
    error,
    setBenchmarkIndex,
    addTransaction,
    deleteTransaction,
    syncIndexes,
    syncListings,
    suggestInvest,
    refresh,
  }
}
