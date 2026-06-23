import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { invokeSyncIndexes } from '../lib/sync-indexes'
import {
  computeTopNIndexMetrics,
  DEFAULT_PORTFOLIO_SETTINGS,
  getPlannerConstraints,
  parsePortfolioSettings,
  serializePortfolioSettings,
  type PortfolioSettings,
} from '../lib/portfolio-settings'
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

async function loadBenchmarkConstituents(code: BenchmarkIndex): Promise<IndexConstituent[]> {
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
    .select('*')
    .eq('sync_id', latestSync.id)
    .order('weight_pct', { ascending: false })

  return (rows as IndexConstituent[]) ?? []
}

async function loadKmi30Constituents(): Promise<IndexConstituent[]> {
  return loadBenchmarkConstituents('KMI30')
}

async function loadPortfolioSettings(userId: string) {
  const { data } = await supabase
    .from('portfolio_settings')
    .select('primary_index, rules')
    .eq('user_id', userId)
    .maybeSingle()

  return parsePortfolioSettings(data)
}

export function usePortfolio(userId: string | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [prices, setPrices] = useState<StockPrice[]>([])
  const [syncs, setSyncs] = useState<IndexSync[]>([])
  const [constituents, setConstituents] = useState<IndexConstituent[]>([])
  const [kmi30Constituents, setKmi30Constituents] = useState<IndexConstituent[]>([])
  const [kse100Constituents, setKse100Constituents] = useState<IndexConstituent[]>([])
  const [portfolioSettings, setPortfolioSettings] = useState<PortfolioSettings>(
    DEFAULT_PORTFOLIO_SETTINGS,
  )
  const [settingsSaving, setSettingsSaving] = useState(false)
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
  const comparison: ComparisonRow[] = useMemo(
    () =>
      buildComparison(
        constituents,
        holdings,
        priceMap,
        shariahSymbols,
        portfolioSettings.rules[benchmark],
      ),
    [constituents, holdings, priceMap, shariahSymbols, portfolioSettings.rules, benchmark],
  )
  const kmi30Comparison = useMemo(
    () =>
      buildComparison(
        kmi30Constituents,
        holdings,
        priceMap,
        shariahSymbols,
        portfolioSettings.rules.KMI30,
      ),
    [kmi30Constituents, holdings, priceMap, shariahSymbols, portfolioSettings.rules],
  )
  const kse100Comparison = useMemo(
    () =>
      buildComparison(
        kse100Constituents,
        holdings,
        priceMap,
        shariahSymbols,
        portfolioSettings.rules.KSE100,
      ),
    [kse100Constituents, holdings, priceMap, shariahSymbols, portfolioSettings.rules],
  )
  const primaryComparison = useMemo(() => {
    return portfolioSettings.primaryIndex === 'KSE100' ? kse100Comparison : kmi30Comparison
  }, [portfolioSettings.primaryIndex, kse100Comparison, kmi30Comparison])

  const constituentsByIndex = useMemo(
    (): Record<BenchmarkIndex, IndexConstituent[]> => ({
      KMI30: kmi30Constituents,
      KSE100: kse100Constituents,
    }),
    [kmi30Constituents, kse100Constituents],
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

    const [txRes, priceRes, syncRes, kmi30Rows, kse100Rows, benchmarkSymbolSet, shariahSymbolSet, settings] =
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
      loadBenchmarkConstituents('KSE100'),
      loadBenchmarkSymbols(),
      loadShariahSymbols(),
      loadPortfolioSettings(userId),
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
    setKse100Constituents(kse100Rows)
    setBenchmarkSymbols(benchmarkSymbolSet)
    setShariahSymbols(shariahSymbolSet)
    setPortfolioSettings(settings)
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

  const savePortfolioSettings = async (next: PortfolioSettings) => {
    if (!userId) return { error: 'Not signed in' }
    setSettingsSaving(true)
    const payload = { user_id: userId, ...serializePortfolioSettings(next) }
    const { error: upsertError } = await supabase
      .from('portfolio_settings')
      .upsert(payload, { onConflict: 'user_id' })

    setSettingsSaving(false)
    if (upsertError) return { error: upsertError.message }

    setPortfolioSettings(next)
    if (next.primaryIndex !== portfolioSettings.primaryIndex) {
      await loadBenchmark(next.primaryIndex)
      setBenchmark(next.primaryIndex)
    }
    return { error: null }
  }

  const suggestInvest = (amount: number) => {
    const constraints = getPlannerConstraints(portfolioSettings)
    const constituents = constituentsByIndex[portfolioSettings.primaryIndex]
    const indexTopN = computeTopNIndexMetrics(constituents, constraints.topNCount).indexWeightPct

    return suggestShareBuys(
      amount,
      primaryComparison,
      true,
      constraints,
      holdings,
      indexTopN,
    )
  }

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
    kse100Comparison,
    primaryComparison,
    portfolioSettings,
    constituentsByIndex,
    settingsSaving,
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
    savePortfolioSettings,
    refresh,
  }
}
