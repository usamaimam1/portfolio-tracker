import type { SupabaseClient } from '@supabase/supabase-js'

type Session = 'open' | 'close'

interface HoldingSnap {
  symbol: string
  quantity: number
  price: number
  market_value: number
  weight_pct: number
  shariah_compliant: boolean
}

async function loadLatestConstituents(supabase: SupabaseClient, indexCode: string) {
  const { data: latestSync } = await supabase
    .from('index_syncs')
    .select('id')
    .eq('index_code', indexCode)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestSync) return []

  const { data: rows } = await supabase
    .from('index_constituents')
    .select('symbol, weight_pct, price')
    .eq('sync_id', latestSync.id)

  return rows ?? []
}

function normalizeSymbol(symbol: string): string {
  return symbol.replace(/XD$/i, '').trim().toUpperCase()
}

async function computeUserSnapshot(
  supabase: SupabaseClient,
  userId: string,
  session: Session,
  snapshotDate: string,
) {
  const [{ data: txs }, { data: prices }, { data: settings }] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', userId).order('trade_date'),
    supabase.from('stock_prices').select('*'),
    supabase
      .from('portfolio_settings')
      .select('primary_index, rules')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const priceMap = new Map(
    (prices ?? []).map((p) => [normalizeSymbol(p.symbol), p]),
  )

  const state = new Map<string, { qty: number; cost: number }>()
  for (const tx of txs ?? []) {
    const symbol = normalizeSymbol(tx.symbol)
    const qty = Number(tx.quantity)
    const price = Number(tx.price_per_share)
    const fees =
      Number(tx.fees ?? 0) ||
      Number(tx.cvt_wht ?? 0) +
        Number(tx.sales_tax ?? 0) +
        Number(tx.cdc_charges ?? 0) +
        Number(tx.advance_tax ?? 0)
    const current = state.get(symbol) ?? { qty: 0, cost: 0 }

    if (tx.type === 'buy') {
      current.qty += qty
      current.cost += qty * price + fees
    } else {
      const avg = current.qty > 0 ? current.cost / current.qty : 0
      current.qty -= qty
      current.cost = current.qty > 0 ? current.qty * avg : 0
    }

    if (current.qty <= 0) state.delete(symbol)
    else state.set(symbol, current)
  }

  let totalValue = 0
  let totalCost = 0
  const holdings: HoldingSnap[] = []

  for (const [symbol, { qty, cost }] of state) {
    const row = priceMap.get(symbol)
    const price = row ? Number(row.price) : 0
    const marketValue = qty * price
    totalValue += marketValue
    totalCost += cost
    holdings.push({
      symbol,
      quantity: qty,
      price,
      market_value: marketValue,
      weight_pct: 0,
      shariah_compliant: row?.shariah_compliant ?? false,
    })
  }

  for (const h of holdings) {
    h.weight_pct = totalValue > 0 ? (h.market_value / totalValue) * 100 : 0
  }

  holdings.sort((a, b) => b.market_value - a.market_value)

  const primaryIndex = settings?.primary_index === 'KSE100' ? 'KSE100' : 'KMI30'
  const [kmi30, kse100] = await Promise.all([
    loadLatestConstituents(supabase, 'KMI30'),
    loadLatestConstituents(supabase, 'KSE100'),
  ])

  const indexMetrics: Record<string, { constituents: number; top_price: number | null }> = {
    KMI30: {
      constituents: kmi30.length,
      top_price: kmi30[0] ? Number(kmi30[0].price) : null,
    },
    KSE100: {
      constituents: kse100.length,
      top_price: kse100[0] ? Number(kse100[0].price) : null,
    },
  }

  const rules = (settings?.rules ?? {}) as Record<string, { top_n_count?: number; top_n_budget_pct?: number }>
  const primaryRule = rules[primaryIndex] ?? {}

  await supabase.from('portfolio_daily_snapshots').upsert(
    {
      user_id: userId,
      snapshot_date: snapshotDate,
      session,
      total_value: totalValue,
      total_cost: totalCost,
      unrealized_pnl: totalValue - totalCost,
      holdings,
      index_metrics: indexMetrics,
      preferred_metrics: {
        primary_index: primaryIndex,
        top_n_count: primaryRule.top_n_count ?? 15,
        top_n_budget_pct: primaryRule.top_n_budget_pct ?? 80,
      },
    },
    { onConflict: 'user_id,snapshot_date,session' },
  )
}

export async function generateSnapshots(supabase: SupabaseClient, session: Session) {
  const snapshotDate = new Date().toISOString().slice(0, 10)

  const { data: userRows } = await supabase.from('transactions').select('user_id')
  const userIds = [...new Set((userRows ?? []).map((r) => r.user_id as string))]

  for (const userId of userIds) {
    await computeUserSnapshot(supabase, userId, session, snapshotDate)
  }
}

/** @deprecated use generateSnapshots */
export const generateSnapshotsAndEmail = generateSnapshots
