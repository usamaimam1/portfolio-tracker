export type BenchmarkIndex = 'KMI30' | 'KSE100'
export type ListingIndex = 'ALLSHR' | 'KMIALLSHR'
export type IndexCode = BenchmarkIndex | ListingIndex

export type SyncMode = 'benchmark' | 'listings'

export type TransactionType = 'buy' | 'sell'

export interface Transaction {
  id: string
  user_id: string
  symbol: string
  type: TransactionType
  quantity: number
  price_per_share: number
  fees: number
  trade_date: string
  notes: string | null
  created_at: string
}

export interface StockPrice {
  symbol: string
  name: string | null
  price: number
  prev_close: number | null
  shariah_compliant: boolean
  updated_at: string
}

export interface IndexConstituent {
  id: string
  sync_id: string
  symbol: string
  name: string
  weight_pct: number
  price: number
  prev_close: number | null
  volume: number | null
  market_cap_m: number | null
}

export interface IndexSync {
  id: string
  index_code: IndexCode | string
  synced_at: string
}

export interface Holding {
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number | null
  marketValue: number
  costBasis: number
  unrealizedPnl: number
  portfolioWeight: number
  dayChangePct: number | null
  shariahCompliant: boolean
}

export type WeightMode = 'actual' | 'preferred'

export interface ComparisonRow {
  symbol: string
  name: string
  /** Active reference weight (set via withWeightMode). */
  indexWeight: number
  /** Raw PSX index weight. */
  actualIndexWeight: number
  /** Target weight from Settings (top-N concentration). */
  preferredIndexWeight: number
  portfolioWeight: number
  drift: number
  actualDrift: number
  preferredDrift: number
  quantity: number
  marketValue: number
  indexPrice: number
  owned: boolean
  shariahCompliant: boolean
  inTopN: boolean
}

export interface PortfolioSummary {
  totalValue: number
  totalCost: number
  unrealizedPnl: number
  holdings: Holding[]
}

export interface ComplianceSummary {
  compliantValue: number
  nonCompliantValue: number
  compliantWeight: number
  nonCompliantWeight: number
  compliantCount: number
  nonCompliantCount: number
}

export type ComplianceFilter = 'all' | 'shariah' | 'non-shariah'

export interface ShareBuySuggestion {
  symbol: string
  name: string
  shares: number
  pricePerShare: number
  totalCost: number
  driftBefore: number
  driftAfter: number
  indexWeight: number
  remainingGap: number
}

export interface ShareBuyPlan {
  budget: number
  totalSpend: number
  leftover: number
  suggestions: ShareBuySuggestion[]
  message?: string
  topNMetrics?: {
    topNCount: number
    topNBudgetPct: number
    indexTopNWeightPct: number
    portfolioTopNWeightPct: number
    plannedTopNSpendPct: number
  }
}

export interface ParsedConstituent {
  symbol: string
  name: string
  weight_pct: number
  price: number
  prev_close: number | null
  volume: number | null
  market_cap_m: number | null
}
