import { useMemo } from 'react'
import { Card, EmptyState, LoadingState } from '../components/ui'
import { usePortfolioContext } from '../context/PortfolioContext'
import {
  downloadBlob,
  exportAllHoldingsCsv,
  exportLivePortfolioCsv,
  exportSnapshotHoldingsCsv,
  exportSnapshotJson,
  exportSnapshotsSummaryCsv,
  snapshotFilename,
} from '../lib/report-export'
import { formatPkr } from '../lib/portfolio'
import type { PortfolioDailySnapshot } from '../types'

function SnapshotCard({ snap }: { snap: PortfolioDailySnapshot }) {
  const holdings = (snap.holdings ?? []) as {
    symbol: string
    weight_pct: number
    market_value: number
  }[]

  const downloadHoldingsCsv = () => {
    downloadBlob(
      snapshotFilename(snap, 'holdings.csv'),
      exportSnapshotHoldingsCsv(snap),
      'text/csv;charset=utf-8',
    )
  }

  const downloadJson = () => {
    downloadBlob(
      snapshotFilename(snap, 'json'),
      exportSnapshotJson(snap),
      'application/json',
    )
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-slate-200">
          {snap.snapshot_date} · <span className="capitalize">{snap.session}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadHoldingsCsv}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            JSON
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">{new Date(snap.created_at).toLocaleString()}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Value</p>
          <p className="text-lg font-semibold text-emerald-400">{formatPkr(Number(snap.total_value))}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Unrealized P&amp;L</p>
          <p className="text-lg font-semibold">{formatPkr(Number(snap.unrealized_pnl))}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Holdings</p>
          <p className="text-lg font-semibold">{holdings.length}</p>
        </div>
      </div>
      {holdings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {holdings.slice(0, 8).map((h) => (
            <span key={h.symbol} className="rounded bg-slate-900 px-2 py-0.5 text-xs text-slate-400">
              {h.symbol} {h.weight_pct?.toFixed?.(1) ?? 0}%
            </span>
          ))}
          {holdings.length > 8 && (
            <span className="text-xs text-slate-500">+{holdings.length - 8} more</span>
          )}
        </div>
      )}
    </div>
  )
}

export function ReportsPage() {
  const {
    loading,
    snapshots,
    syncRuns,
    summary,
    holdings,
    compliance,
    portfolioSettings,
  } = usePortfolioContext()

  const byDate = useMemo(() => {
    const map = new Map<string, PortfolioDailySnapshot[]>()
    for (const s of snapshots) {
      const list = map.get(s.snapshot_date) ?? []
      list.push(s)
      map.set(s.snapshot_date, list)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [snapshots])

  const downloadSummary = () => {
    downloadBlob(
      `psx-reports-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      exportSnapshotsSummaryCsv(snapshots),
      'text/csv;charset=utf-8',
    )
  }

  const downloadAllHoldings = () => {
    downloadBlob(
      `psx-reports-all-holdings-${new Date().toISOString().slice(0, 10)}.csv`,
      exportAllHoldingsCsv(snapshots),
      'text/csv;charset=utf-8',
    )
  }

  const downloadCurrentPortfolio = () => {
    const rule = portfolioSettings.rules[portfolioSettings.primaryIndex]
    downloadBlob(
      `psx-portfolio-current-${new Date().toISOString().slice(0, 10)}.csv`,
      exportLivePortfolioCsv({
        summary,
        holdings,
        primaryIndex: portfolioSettings.primaryIndex,
        topNCount: rule.topNCount,
        topNBudgetPct: rule.topNBudgetPct,
        compliantWeight: compliance.compliantWeight,
      }),
      'text/csv;charset=utf-8',
    )
  }

  if (loading) return <LoadingState />

  const lastClose = syncRuns.find((r) => r.session === 'close' && r.status === 'success')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Daily reports</h2>
          <p className="text-sm text-slate-400">
            Open/close snapshots from scheduled sync. Download CSV or JSON anytime.
          </p>
        </div>
      </div>

      <Card title="Download reports">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadCurrentPortfolio}
            disabled={holdings.length === 0}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            Current portfolio (CSV)
          </button>
          <button
            type="button"
            onClick={downloadSummary}
            disabled={snapshots.length === 0}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            All snapshots summary (CSV)
          </button>
          <button
            type="button"
            onClick={downloadAllHoldings}
            disabled={snapshots.length === 0}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            All snapshot holdings (CSV)
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Current portfolio uses live holdings and prices. Snapshot exports use data captured at
          market open/close after PSX sync.
        </p>
      </Card>

      <Card title="Scheduled sync status">
        {lastClose ? (
          <p className="text-sm text-slate-300">
            Last close sync:{' '}
            {new Date(lastClose.finished_at ?? lastClose.started_at).toLocaleString()}
            {lastClose.counts && (
              <span className="text-slate-500">
                {' '}
                · {Object.entries(lastClose.counts).map(([k, v]) => `${k}: ${v}`).join(', ')}
              </span>
            )}
          </p>
        ) : (
          <EmptyState message="No scheduled close sync recorded yet. Use Current portfolio to export now." />
        )}
      </Card>

      <Card title="Snapshot history">
        {byDate.length === 0 ? (
          <EmptyState message="No snapshots yet. Download your current portfolio above, or wait for scheduled open/close sync." />
        ) : (
          <div className="space-y-3">
            {byDate.map(([date, snaps]) => (
              <div key={date}>
                <p className="mb-2 text-sm font-medium text-slate-400">{date}</p>
                <div className="space-y-2">
                  {snaps
                    .sort((a, b) => a.session.localeCompare(b.session))
                    .map((snap) => (
                      <SnapshotCard key={snap.id} snap={snap} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
