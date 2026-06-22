import type {
  ComparisonRow,
  ComplianceFilter,
  ComplianceSummary,
  Holding,
  IndexConstituent,
  PortfolioSummary,
  ShareBuyPlan,
  ShareBuySuggestion,
  StockPrice,
  Transaction,
} from '../types'

function parseNum(value: number | string): number {
  return typeof value === 'string' ? parseFloat(value) : value
}

export function normalizeSymbol(symbol: string): string {
  return symbol.replace(/XD$/i, '').trim().toUpperCase()
}

export function isShariahCompliant(
  symbol: string,
  prices: Map<string, StockPrice>,
  shariahSymbols?: Set<string>,
): boolean {
  const key = normalizeSymbol(symbol)
  if (shariahSymbols) return shariahSymbols.has(key)
  return prices.get(key)?.shariah_compliant ?? false
}

export function buildPriceMap(prices: StockPrice[]): Map<string, StockPrice> {
  const map = new Map<string, StockPrice>()
  for (const p of prices) {
    map.set(normalizeSymbol(p.symbol), {
      ...p,
      symbol: normalizeSymbol(p.symbol),
      shariah_compliant: p.shariah_compliant ?? false,
    })
  }
  return map
}

export function buildShariahSymbolSet(symbols: Iterable<string>): Set<string> {
  return new Set([...symbols].map(normalizeSymbol))
}

export function computeHoldings(
  transactions: Transaction[],
  prices: Map<string, StockPrice>,
  shariahSymbols?: Set<string>,
): Holding[] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime(),
  )

  const state = new Map<string, { qty: number; totalCost: number }>()

  for (const tx of sorted) {
    const symbol = normalizeSymbol(tx.symbol)
    const qty = parseNum(tx.quantity)
    const price = parseNum(tx.price_per_share)
    const fees = parseNum(tx.fees ?? 0)
    const current = state.get(symbol) ?? { qty: 0, totalCost: 0 }

    if (tx.type === 'buy') {
      current.totalCost += qty * price + fees
      current.qty += qty
    } else {
      if (current.qty > 0) {
        const avgCost = current.totalCost / current.qty
        current.qty -= qty
        current.totalCost = current.qty > 0 ? current.qty * avgCost : 0
      }
    }

    if (current.qty <= 0) {
      state.delete(symbol)
    } else {
      state.set(symbol, current)
    }
  }

  const holdings: Holding[] = []
  let totalValue = 0

  for (const [symbol, { qty, totalCost }] of state) {
    const priceRow = prices.get(symbol)
    const currentPrice = priceRow ? parseNum(priceRow.price) : null
    const marketValue = currentPrice !== null ? qty * currentPrice : 0
    totalValue += marketValue

    const avgCost = qty > 0 ? totalCost / qty : 0
    const prevClose = priceRow?.prev_close ? parseNum(priceRow.prev_close) : null
    const dayChangePct =
      currentPrice !== null && prevClose && prevClose > 0
        ? ((currentPrice - prevClose) / prevClose) * 100
        : null

    holdings.push({
      symbol,
      quantity: qty,
      avgCost,
      currentPrice,
      marketValue,
      costBasis: totalCost,
      unrealizedPnl: marketValue - totalCost,
      portfolioWeight: 0,
      dayChangePct,
      shariahCompliant: isShariahCompliant(symbol, prices, shariahSymbols),
    })
  }

  for (const h of holdings) {
    h.portfolioWeight = totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0
  }

  return holdings.sort((a, b) => b.marketValue - a.marketValue)
}

export function summarizePortfolio(holdings: Holding[]): PortfolioSummary {
  const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0)
  const totalCost = holdings.reduce((s, h) => s + h.costBasis, 0)
  return {
    totalValue,
    totalCost,
    unrealizedPnl: totalValue - totalCost,
    holdings,
  }
}

export function summarizeCompliance(holdings: Holding[]): ComplianceSummary {
  let compliantValue = 0
  let nonCompliantValue = 0
  let compliantCount = 0
  let nonCompliantCount = 0

  for (const h of holdings) {
    if (h.shariahCompliant) {
      compliantValue += h.marketValue
      compliantCount += 1
    } else {
      nonCompliantValue += h.marketValue
      nonCompliantCount += 1
    }
  }

  const total = compliantValue + nonCompliantValue

  return {
    compliantValue,
    nonCompliantValue,
    compliantWeight: total > 0 ? (compliantValue / total) * 100 : 0,
    nonCompliantWeight: total > 0 ? (nonCompliantValue / total) * 100 : 0,
    compliantCount,
    nonCompliantCount,
  }
}

export function buildComparison(
  constituents: IndexConstituent[],
  holdings: Holding[],
  prices: Map<string, StockPrice>,
  shariahSymbols?: Set<string>,
): ComparisonRow[] {
  const holdingMap = new Map(holdings.map((h) => [h.symbol, h]))
  const totalPortfolio = holdings.reduce((s, h) => s + h.marketValue, 0)

  const rows: ComparisonRow[] = constituents.map((c) => {
    const symbol = normalizeSymbol(c.symbol)
    const holding = holdingMap.get(symbol)
    const indexWeight = parseNum(c.weight_pct)
    const portfolioWeight =
      holding && totalPortfolio > 0 ? (holding.marketValue / totalPortfolio) * 100 : 0

    return {
      symbol,
      name: c.name,
      indexWeight,
      portfolioWeight,
      drift: portfolioWeight - indexWeight,
      quantity: holding?.quantity ?? 0,
      marketValue: holding?.marketValue ?? 0,
      indexPrice: parseNum(c.price),
      owned: !!holding,
      shariahCompliant: isShariahCompliant(symbol, prices, shariahSymbols),
    }
  })

  // Stocks owned but not in index
  const indexSymbols = new Set(constituents.map((c) => normalizeSymbol(c.symbol)))
  for (const h of holdings) {
    if (!indexSymbols.has(h.symbol)) {
      rows.push({
        symbol: h.symbol,
        name: h.symbol,
        indexWeight: 0,
        portfolioWeight: h.portfolioWeight,
        drift: h.portfolioWeight,
        quantity: h.quantity,
        marketValue: h.marketValue,
        indexPrice: h.currentPrice ?? 0,
        owned: true,
        shariahCompliant: h.shariahCompliant,
      })
    }
  }

  return rows.sort((a, b) => a.drift - b.drift)
}

export function filterByCompliance<T extends { shariahCompliant: boolean }>(
  rows: T[],
  filter: ComplianceFilter,
): T[] {
  if (filter === 'shariah') return rows.filter((r) => r.shariahCompliant)
  if (filter === 'non-shariah') return rows.filter((r) => !r.shariahCompliant)
  return rows
}

export function suggestShareBuys(
  budget: number,
  comparison: ComparisonRow[],
  shariahOnly = true,
): ShareBuyPlan {
  const empty = (message?: string): ShareBuyPlan => ({
    budget,
    totalSpend: 0,
    leftover: budget,
    suggestions: [],
    message,
  })

  if (budget <= 0) return empty('Enter an investment amount.')

  const pool = comparison.filter(
    (r) => r.indexWeight > 0 && r.indexPrice > 0 && (!shariahOnly || r.shariahCompliant),
  )
  if (pool.length === 0) {
    return empty('Sync indexes from PSX to get stock prices and weights.')
  }

  const currentTotal = comparison.filter((r) => r.owned).reduce((s, r) => s + r.marketValue, 0)
  const projectedTotal = currentTotal + budget

  interface SimStock {
    symbol: string
    name: string
    indexWeight: number
    price: number
    marketValue: number
    drift: number
    plannedShares: number
  }

  const sim: SimStock[] = pool.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    indexWeight: r.indexWeight,
    price: r.indexPrice,
    marketValue: r.marketValue,
    drift: r.drift,
    plannedShares: 0,
  }))

  const targetValue = (s: SimStock) => projectedTotal * (s.indexWeight / 100)

  const valueGap = (s: SimStock) => {
    const plannedValue = s.plannedShares * s.price
    return targetValue(s) - s.marketValue - plannedValue
  }

  let remaining = budget

  // Proportional floor: seed whole-share counts from index-weight gaps.
  const gaps = sim.map((s) => Math.max(0, targetValue(s) - s.marketValue))
  const totalGap = gaps.reduce((sum, g) => sum + g, 0)

  for (let i = 0; i < sim.length; i++) {
    const s = sim[i]
    const share = totalGap > 0 ? gaps[i] / totalGap : s.indexWeight / 100
    const idealSpend = budget * share
    const shares = Math.floor(idealSpend / s.price)
    if (shares <= 0) continue

    const cost = shares * s.price
    if (cost > remaining) {
      const affordable = Math.floor(remaining / s.price)
      if (affordable <= 0) continue
      s.plannedShares = affordable
      remaining -= affordable * s.price
    } else {
      s.plannedShares = shares
      remaining -= cost
    }
  }

  // Greedy top-up: buy +1 share for the largest remaining gap while budget allows.
  while (remaining > 0) {
    const candidates = sim.filter((s) => s.price <= remaining)
    if (candidates.length === 0) break

    candidates.sort((a, b) => valueGap(b) - valueGap(a))
    const pick = candidates[0]
    if (valueGap(pick) <= 0 && sim.some((s) => s.plannedShares > 0)) break

    pick.plannedShares += 1
    remaining -= pick.price
  }

  const totalSpend = budget - remaining
  const newTotal = currentTotal + totalSpend

  const suggestions: ShareBuySuggestion[] = sim
    .filter((s) => s.plannedShares > 0)
    .map((s) => {
      const addedValue = s.plannedShares * s.price
      const newValue = s.marketValue + addedValue
      const newWeight = newTotal > 0 ? (newValue / newTotal) * 100 : 0

      return {
        symbol: s.symbol,
        name: s.name,
        shares: s.plannedShares,
        pricePerShare: s.price,
        totalCost: addedValue,
        driftBefore: s.drift,
        driftAfter: newWeight - s.indexWeight,
        indexWeight: s.indexWeight,
        remainingGap: targetValue(s) - newValue,
      }
    })
    .sort((a, b) => a.driftAfter - b.driftAfter)

  if (suggestions.length === 0) {
    const minPrice = Math.min(...pool.map((r) => r.indexPrice))
    if (budget < minPrice) {
      return empty(`Budget is below the cheapest stock (${formatPrice(minPrice)} per share).`)
    }
    return empty('Portfolio is aligned with the index — no underweight Shariah stocks to buy.')
  }

  return { budget, totalSpend, leftover: remaining, suggestions }
}

export function suggestAllocation(
  amount: number,
  comparison: ComparisonRow[],
  limit = 5,
  shariahOnly = true,
): { symbol: string; name: string; amount: number; drift: number }[] {
  const pool = shariahOnly ? comparison.filter((r) => r.shariahCompliant) : comparison
  const underweight = pool
    .filter((r) => r.drift < 0 && r.indexWeight > 0)
    .sort((a, b) => a.drift - b.drift)
    .slice(0, limit)

  if (underweight.length === 0) return []

  const totalIndexWeight = underweight.reduce((s, r) => s + r.indexWeight, 0)

  return underweight.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    drift: r.drift,
    amount: totalIndexWeight > 0 ? (r.indexWeight / totalIndexWeight) * amount : amount / underweight.length,
  }))
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPkr(value: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPct(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function formatQty(value: number): string {
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(value)
}
