import type { BenchmarkIndex, Holding, IndexConstituent } from '../types'

export type { BenchmarkIndex }

function normalizeSymbol(symbol: string): string {
  return symbol.replace(/XD$/i, '').trim().toUpperCase()
}

export type RestDistribution = 'equal' | 'custom'

export interface IndexPortfolioRule {
  topNCount: number
  topNBudgetPct: number
  enabled: boolean
  restDistribution: RestDistribution
  /** Percent of remainder bucket per symbol (should sum to 100). */
  customRestWeights: Record<string, number>
}

export interface PortfolioSettings {
  primaryIndex: BenchmarkIndex
  rules: Record<BenchmarkIndex, IndexPortfolioRule>
}

export interface TopNIndexMetrics {
  topNCount: number
  indexWeightPct: number
  symbols: string[]
}

export interface CustomBucketMetrics {
  symbolCount: number
  restBudgetPct: number
  equalWeightPct: number
  symbols: string[]
}

export interface PlannerConstraints {
  topNCount: number
  topNBudgetPct: number
  restDistribution: RestDistribution
  customRestWeights: Record<string, number>
}

const BENCHMARK_INDEXES: BenchmarkIndex[] = ['KMI30', 'KSE100']

export const DEFAULT_INDEX_RULE: IndexPortfolioRule = {
  topNCount: 15,
  topNBudgetPct: 80,
  enabled: true,
  restDistribution: 'equal',
  customRestWeights: {},
}

export const DEFAULT_PORTFOLIO_SETTINGS: PortfolioSettings = {
  primaryIndex: 'KMI30',
  rules: {
    KMI30: { ...DEFAULT_INDEX_RULE },
    KSE100: { ...DEFAULT_INDEX_RULE, topNCount: 15 },
  },
}

function parseNum(value: number | string): number {
  return typeof value === 'string' ? parseFloat(value) : value
}

function normalizeRule(raw: unknown): IndexPortfolioRule {
  const r = (raw ?? {}) as Record<string, unknown>
  const customRaw = (r.custom_rest_weights ?? r.customRestWeights ?? {}) as Record<string, number>
  const customRestWeights: Record<string, number> = {}
  for (const [sym, w] of Object.entries(customRaw)) {
    customRestWeights[normalizeSymbol(sym)] = Number(w) || 0
  }

  const restDistribution =
    r.rest_distribution === 'custom' || r.restDistribution === 'custom' ? 'custom' : 'equal'

  return {
    topNCount: Math.min(30, Math.max(1, Number(r.top_n_count ?? r.topNCount) || DEFAULT_INDEX_RULE.topNCount)),
    topNBudgetPct: Math.min(
      100,
      Math.max(0, Number(r.top_n_budget_pct ?? r.topNBudgetPct) || DEFAULT_INDEX_RULE.topNBudgetPct),
    ),
    enabled: r.enabled !== false,
    restDistribution,
    customRestWeights,
  }
}

export function parsePortfolioSettings(row: {
  primary_index?: string
  rules?: unknown
} | null): PortfolioSettings {
  if (!row) return { ...DEFAULT_PORTFOLIO_SETTINGS, rules: { ...DEFAULT_PORTFOLIO_SETTINGS.rules } }

  const rawRules = (row.rules ?? {}) as Record<string, unknown>
  const rules = {} as Record<BenchmarkIndex, IndexPortfolioRule>

  for (const code of BENCHMARK_INDEXES) {
    rules[code] = normalizeRule(rawRules[code])
  }

  const primaryIndex =
    row.primary_index === 'KSE100' ? 'KSE100' : ('KMI30' as BenchmarkIndex)

  return { primaryIndex, rules }
}

export function serializePortfolioSettings(settings: PortfolioSettings) {
  const rules: Record<
    string,
    {
      top_n_count: number
      top_n_budget_pct: number
      enabled: boolean
      rest_distribution: RestDistribution
      custom_rest_weights: Record<string, number>
    }
  > = {}
  for (const code of BENCHMARK_INDEXES) {
    const r = settings.rules[code]
    rules[code] = {
      top_n_count: r.topNCount,
      top_n_budget_pct: r.topNBudgetPct,
      enabled: r.enabled,
      rest_distribution: r.restDistribution,
      custom_rest_weights: r.customRestWeights,
    }
  }
  return {
    primary_index: settings.primaryIndex,
    rules,
    updated_at: new Date().toISOString(),
  }
}

export function getTopNSymbolsFromConstituents(
  constituents: IndexConstituent[],
  topNCount: number,
): Set<string> {
  const sorted = [...constituents].sort(
    (a, b) => parseNum(b.weight_pct) - parseNum(a.weight_pct),
  )
  return new Set(sorted.slice(0, topNCount).map((c) => normalizeSymbol(c.symbol)))
}

/** Owned holdings outside top N — includes off-index positions. */
export function getCustomBucketSymbols(
  holdings: Holding[],
  topNSymbols: Set<string>,
): string[] {
  return holdings
    .filter((h) => h.quantity > 0 && !topNSymbols.has(h.symbol))
    .map((h) => h.symbol)
    .sort((a, b) => a.localeCompare(b))
}

export function computeTopNIndexMetrics(
  constituents: IndexConstituent[],
  topNCount: number,
): TopNIndexMetrics {
  const sorted = [...constituents].sort(
    (a, b) => parseNum(b.weight_pct) - parseNum(a.weight_pct),
  )
  const top = sorted.slice(0, topNCount)
  const indexWeightPct = top.reduce((sum, c) => sum + parseNum(c.weight_pct), 0)

  return {
    topNCount,
    indexWeightPct,
    symbols: top.map((c) => normalizeSymbol(c.symbol)),
  }
}

export function computeCustomBucketMetrics(
  holdings: Holding[],
  rule: IndexPortfolioRule,
  topNSymbols: Set<string>,
): CustomBucketMetrics {
  const symbols = getCustomBucketSymbols(holdings, topNSymbols)
  const restBudgetPct = 100 - rule.topNBudgetPct
  const equalWeightPct = symbols.length > 0 ? restBudgetPct / symbols.length : 0

  return { symbolCount: symbols.length, restBudgetPct, equalWeightPct, symbols }
}

export function buildPreferredWeights(
  constituents: IndexConstituent[],
  rule: IndexPortfolioRule,
  holdings: Holding[],
): Map<string, number> {
  const sorted = [...constituents].sort(
    (a, b) => parseNum(b.weight_pct) - parseNum(a.weight_pct),
  )
  const top = sorted.slice(0, rule.topNCount)
  const topNSymbols = new Set(top.map((c) => normalizeSymbol(c.symbol)))

  const topIndexSum = top.reduce((sum, c) => sum + parseNum(c.weight_pct), 0)
  const restBudgetPct = 100 - rule.topNBudgetPct
  const customSymbols = getCustomBucketSymbols(holdings, topNSymbols)

  const weights = new Map<string, number>()

  for (const c of top) {
    const symbol = normalizeSymbol(c.symbol)
    const share =
      topIndexSum > 0
        ? parseNum(c.weight_pct) / topIndexSum
        : top.length > 0
          ? 1 / top.length
          : 0
    weights.set(symbol, rule.topNBudgetPct * share)
  }

  if (customSymbols.length > 0 && restBudgetPct > 0) {
    if (rule.restDistribution === 'custom') {
      const rawSum = customSymbols.reduce(
        (sum, sym) => sum + (rule.customRestWeights[sym] ?? 0),
        0,
      )
      const divisor = rawSum > 0 ? rawSum : customSymbols.length

      for (const symbol of customSymbols) {
        const share =
          rawSum > 0
            ? (rule.customRestWeights[symbol] ?? 0) / divisor
            : 1 / customSymbols.length
        weights.set(symbol, restBudgetPct * share)
      }
    } else {
      const each = restBudgetPct / customSymbols.length
      for (const symbol of customSymbols) {
        weights.set(symbol, each)
      }
    }
  }

  return weights
}

export function getPlannerConstraints(
  settings: PortfolioSettings,
  indexCode?: BenchmarkIndex,
): PlannerConstraints {
  const code = indexCode ?? settings.primaryIndex
  const rule = settings.rules[code]
  return {
    topNCount: rule.topNCount,
    topNBudgetPct: rule.topNBudgetPct,
    restDistribution: rule.restDistribution,
    customRestWeights: rule.customRestWeights,
  }
}
