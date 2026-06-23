import type { BenchmarkIndex, IndexConstituent } from '../types'

export type { BenchmarkIndex }

export interface IndexPortfolioRule {
  topNCount: number
  topNBudgetPct: number
  enabled: boolean
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

export interface PlannerConstraints {
  topNCount: number
  topNBudgetPct: number
}

const BENCHMARK_INDEXES: BenchmarkIndex[] = ['KMI30', 'KSE100']

export const DEFAULT_INDEX_RULE: IndexPortfolioRule = {
  topNCount: 15,
  topNBudgetPct: 80,
  enabled: true,
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
  return {
    topNCount: Math.min(30, Math.max(1, Number(r.top_n_count ?? r.topNCount) || DEFAULT_INDEX_RULE.topNCount)),
    topNBudgetPct: Math.min(
      100,
      Math.max(0, Number(r.top_n_budget_pct ?? r.topNBudgetPct) || DEFAULT_INDEX_RULE.topNBudgetPct),
    ),
    enabled: r.enabled !== false,
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
  const rules: Record<string, { top_n_count: number; top_n_budget_pct: number; enabled: boolean }> =
    {}
  for (const code of BENCHMARK_INDEXES) {
    const r = settings.rules[code]
    rules[code] = {
      top_n_count: r.topNCount,
      top_n_budget_pct: r.topNBudgetPct,
      enabled: r.enabled,
    }
  }
  return {
    primary_index: settings.primaryIndex,
    rules,
    updated_at: new Date().toISOString(),
  }
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
    symbols: top.map((c) => c.symbol),
  }
}

export function buildPreferredWeights(
  constituents: IndexConstituent[],
  rule: IndexPortfolioRule,
): Map<string, number> {
  const sorted = [...constituents].sort(
    (a, b) => parseNum(b.weight_pct) - parseNum(a.weight_pct),
  )
  const top = sorted.slice(0, rule.topNCount)
  const rest = sorted.slice(rule.topNCount)

  const topIndexSum = top.reduce((sum, c) => sum + parseNum(c.weight_pct), 0)
  const restIndexSum = rest.reduce((sum, c) => sum + parseNum(c.weight_pct), 0)
  const restBudgetPct = 100 - rule.topNBudgetPct

  const weights = new Map<string, number>()

  for (const c of top) {
    const symbol = c.symbol.replace(/XD$/i, '').trim().toUpperCase()
    const share =
      topIndexSum > 0
        ? parseNum(c.weight_pct) / topIndexSum
        : top.length > 0
          ? 1 / top.length
          : 0
    weights.set(symbol, rule.topNBudgetPct * share)
  }

  for (const c of rest) {
    const symbol = c.symbol.replace(/XD$/i, '').trim().toUpperCase()
    const share =
      restIndexSum > 0
        ? parseNum(c.weight_pct) / restIndexSum
        : rest.length > 0
          ? 1 / rest.length
          : 0
    weights.set(symbol, restBudgetPct * share)
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
  }
}
