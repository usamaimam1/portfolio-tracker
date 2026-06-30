import type { Holding, PortfolioDailySnapshot, PortfolioSummary } from '../types'

export interface SnapshotHolding {
  symbol: string
  quantity: number
  price: number
  market_value: number
  weight_pct: number
  shariah_compliant: boolean
}

function escapeCsv(value: string | number | boolean): string {
  const s = String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function csvRow(cells: (string | number | boolean)[]): string {
  return cells.map(escapeCsv).join(',')
}

export function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseSnapshotHoldings(snap: PortfolioDailySnapshot): SnapshotHolding[] {
  return (snap.holdings ?? []) as SnapshotHolding[]
}

export function exportSnapshotsSummaryCsv(snapshots: PortfolioDailySnapshot[]): string {
  const header = csvRow([
    'date',
    'session',
    'total_value',
    'total_cost',
    'unrealized_pnl',
    'holdings_count',
    'primary_index',
    'top_n_count',
    'top_n_budget_pct',
    'created_at',
  ])

  const rows = snapshots.map((s) => {
    const pref = s.preferred_metrics as {
      primary_index?: string
      top_n_count?: number
      top_n_budget_pct?: number
    }
    return csvRow([
      s.snapshot_date,
      s.session,
      Number(s.total_value),
      Number(s.total_cost),
      Number(s.unrealized_pnl),
      parseSnapshotHoldings(s).length,
      pref.primary_index ?? '',
      pref.top_n_count ?? '',
      pref.top_n_budget_pct ?? '',
      s.created_at,
    ])
  })

  return [header, ...rows].join('\n')
}

export function exportSnapshotHoldingsCsv(snap: PortfolioDailySnapshot): string {
  const holdings = parseSnapshotHoldings(snap)
  const header = csvRow([
    'date',
    'session',
    'symbol',
    'quantity',
    'price',
    'market_value',
    'weight_pct',
    'shariah_compliant',
  ])

  const rows = holdings.map((h) =>
    csvRow([
      snap.snapshot_date,
      snap.session,
      h.symbol,
      h.quantity,
      h.price,
      h.market_value,
      h.weight_pct,
      h.shariah_compliant,
    ]),
  )

  return [header, ...rows].join('\n')
}

export function exportAllHoldingsCsv(snapshots: PortfolioDailySnapshot[]): string {
  const header = csvRow([
    'date',
    'session',
    'symbol',
    'quantity',
    'price',
    'market_value',
    'weight_pct',
    'shariah_compliant',
  ])

  const rows: string[] = []
  for (const snap of snapshots) {
    for (const h of parseSnapshotHoldings(snap)) {
      rows.push(
        csvRow([
          snap.snapshot_date,
          snap.session,
          h.symbol,
          h.quantity,
          h.price,
          h.market_value,
          h.weight_pct,
          h.shariah_compliant,
        ]),
      )
    }
  }

  return [header, ...rows].join('\n')
}

export function exportSnapshotJson(snap: PortfolioDailySnapshot): string {
  return JSON.stringify(snap, null, 2)
}

export interface LiveReportInput {
  summary: PortfolioSummary
  holdings: Holding[]
  primaryIndex: string
  topNCount: number
  topNBudgetPct: number
  compliantWeight: number
  generatedAt?: string
}

export function exportLivePortfolioCsv(input: LiveReportInput): string {
  const date = (input.generatedAt ?? new Date().toISOString()).slice(0, 10)
  const header = csvRow([
    'report_date',
    'symbol',
    'quantity',
    'avg_cost',
    'price',
    'market_value',
    'cost_basis',
    'unrealized_pnl',
    'portfolio_weight_pct',
    'shariah_compliant',
  ])

  const rows = input.holdings.map((h) =>
    csvRow([
      date,
      h.symbol,
      h.quantity,
      h.avgCost,
      h.currentPrice ?? 0,
      h.marketValue,
      h.costBasis,
      h.unrealizedPnl,
      h.portfolioWeight,
      h.shariahCompliant,
    ]),
  )

  const meta = csvRow([
    '# summary',
    `primary_index=${input.primaryIndex}`,
    `top_n=${input.topNCount}`,
    `top_n_budget_pct=${input.topNBudgetPct}`,
    `total_value=${input.summary.totalValue}`,
    `total_cost=${input.summary.totalCost}`,
    `unrealized_pnl=${input.summary.unrealizedPnl}`,
    `shariah_weight_pct=${input.compliantWeight}`,
  ])

  return [meta, header, ...rows].join('\n')
}

export function snapshotFilename(snap: PortfolioDailySnapshot, ext: string): string {
  return `psx-report-${snap.snapshot_date}-${snap.session}.${ext}`
}
