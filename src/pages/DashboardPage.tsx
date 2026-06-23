import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatCards } from '../components/StatCard'
import { SortableTh } from '../components/SortableTh'
import { WeightModeToggle } from '../components/WeightModeToggle'
import { Card, EmptyState, ErrorBanner, LoadingState } from '../components/ui'
import { usePortfolioContext } from '../context/PortfolioContext'
import { useTableSort } from '../hooks/useTableSort'
import { indexLabel } from '../lib/index-labels'
import { formatPct, formatPkr, formatQty, withWeightMode } from '../lib/portfolio'
import type { ComparisonRow, Holding, WeightMode } from '../types'

type DriftSortKey = 'symbol' | 'indexWeight' | 'portfolioWeight' | 'drift'
type HoldingSortKey = 'symbol' | 'quantity' | 'value' | 'weight'

const driftAccessors: Record<DriftSortKey, (r: ComparisonRow) => string | number> = {
  symbol: (r) => r.symbol,
  indexWeight: (r) => r.indexWeight,
  portfolioWeight: (r) => r.portfolioWeight,
  drift: (r) => r.drift,
}

const holdingAccessors: Record<HoldingSortKey, (h: Holding) => string | number> = {
  symbol: (h) => h.symbol,
  quantity: (h) => h.quantity,
  value: (h) => h.marketValue,
  weight: (h) => h.portfolioWeight,
}

export function DashboardPage() {
  const {
    summary,
    compliance,
    holdings,
    comparison,
    benchmark,
    portfolioSettings,
    loading,
    error,
    syncs,
    syncing,
    syncIndexes,
  } = usePortfolioContext()

  const [weightMode, setWeightMode] = useState<WeightMode>('actual')
  const rule = portfolioSettings.rules[benchmark]

  const weightedComparison = useMemo(
    () => withWeightMode(comparison, weightMode),
    [comparison, weightMode],
  )

  const topDrift = useMemo(
    () =>
      [...weightedComparison]
        .filter((r) => r.indexWeight > 0 && r.shariahCompliant)
        .sort((a, b) => a.drift - b.drift)
        .slice(0, 5),
    [weightedComparison],
  )
  const lastSync = syncs.find((s) => s.index_code === benchmark)

  const driftSort = useTableSort<DriftSortKey>('drift', 'asc')
  const holdingSort = useTableSort<HoldingSortKey>('value', 'desc')

  const sortedDrift = useMemo(
    () => driftSort.sort(topDrift, driftAccessors),
    [topDrift, driftSort.sort],
  )
  const sortedHoldings = useMemo(
    () => holdingSort.sort(holdings, holdingAccessors).slice(0, 5),
    [holdings, holdingSort.sort],
  )

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-slate-400">
            Benchmark: {benchmark === 'KMI30' ? 'KMI-30' : 'KSE-100'}
            {lastSync && ` · synced ${new Date(lastSync.synced_at).toLocaleString()}`}
          </p>
        </div>
        <button
          onClick={() => syncIndexes()}
          disabled={syncing !== null}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync PSX indexes'}
        </button>
      </div>

      <StatCards
        totalValue={summary.totalValue}
        totalCost={summary.totalCost}
        unrealizedPnl={summary.unrealizedPnl}
        holdingCount={holdings.length}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Shariah compliant portfolio">
          <p className="text-3xl font-semibold text-emerald-400">
            {compliance.compliantWeight.toFixed(1)}%
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {formatPkr(compliance.compliantValue)} across {compliance.compliantCount} holdings
          </p>
        </Card>
        <Card title="Non-compliant exposure">
          <p
            className={`text-3xl font-semibold ${
              compliance.nonCompliantWeight > 5 ? 'text-rose-400' : 'text-slate-300'
            }`}
          >
            {compliance.nonCompliantWeight.toFixed(1)}%
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {compliance.nonCompliantCount > 0
              ? `${formatPkr(compliance.nonCompliantValue)} in ${compliance.nonCompliantCount} non-compliant holding(s)`
              : 'No non-compliant holdings'}
          </p>
        </Card>
      </div>

      <Card
        title={`Top underweight (Shariah) · ${indexLabel(benchmark)}`}
        action={<WeightModeToggle mode={weightMode} onChange={setWeightMode} />}
      >
        {weightMode === 'preferred' && (
          <p className="mb-3 text-xs text-slate-500">
            Drift vs your preferred target — top {rule.topNCount} names share{' '}
            {rule.topNBudgetPct}% of the target profile.
          </p>
        )}
        {topDrift.length === 0 ? (
          <EmptyState message="Sync index data from PSX to see drift." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <SortableTh label="Symbol" sortKey="symbol" activeKey={driftSort.sortKey} sortDir={driftSort.sortDir} onSort={driftSort.toggle} />
                <SortableTh
                  label={weightMode === 'actual' ? 'Index' : 'Target'}
                  sortKey="indexWeight"
                  activeKey={driftSort.sortKey}
                  sortDir={driftSort.sortDir}
                  onSort={driftSort.toggle}
                  align="right"
                />
                <SortableTh label="Yours" sortKey="portfolioWeight" activeKey={driftSort.sortKey} sortDir={driftSort.sortDir} onSort={driftSort.toggle} align="right" />
                <SortableTh label="Drift" sortKey="drift" activeKey={driftSort.sortKey} sortDir={driftSort.sortDir} onSort={driftSort.toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortedDrift.map((row) => (
                <tr key={row.symbol} className="border-t border-slate-800">
                  <td className="py-2 font-medium">{row.symbol}</td>
                  <td className="py-2 text-right text-slate-400">{row.indexWeight.toFixed(2)}%</td>
                  <td className="py-2 text-right">{row.portfolioWeight.toFixed(2)}%</td>
                  <td className={`py-2 text-right ${row.drift < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {formatPct(row.drift)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card
        title="Top holdings"
        action={
          <Link to="/portfolio" className="text-sm text-emerald-400 hover:underline">
            View all
          </Link>
        }
      >
        {holdings.length === 0 ? (
          <EmptyState message="No holdings yet. Log your first buy on the Transactions page." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <SortableTh label="Symbol" sortKey="symbol" activeKey={holdingSort.sortKey} sortDir={holdingSort.sortDir} onSort={holdingSort.toggle} />
                <SortableTh label="Qty" sortKey="quantity" activeKey={holdingSort.sortKey} sortDir={holdingSort.sortDir} onSort={holdingSort.toggle} align="right" />
                <SortableTh label="Value" sortKey="value" activeKey={holdingSort.sortKey} sortDir={holdingSort.sortDir} onSort={holdingSort.toggle} align="right" />
                <SortableTh label="Weight" sortKey="weight" activeKey={holdingSort.sortKey} sortDir={holdingSort.sortDir} onSort={holdingSort.toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((h) => (
                <tr key={h.symbol} className="border-t border-slate-800">
                  <td className="py-2 font-medium">{h.symbol}</td>
                  <td className="py-2 text-right text-slate-400">{formatQty(h.quantity)}</td>
                  <td className="py-2 text-right">{formatPkr(h.marketValue)}</td>
                  <td className="py-2 text-right">{h.portfolioWeight.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
