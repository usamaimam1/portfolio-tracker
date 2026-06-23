import { useMemo, useState } from 'react'
import { Card, EmptyState, LoadingState } from '../components/ui'
import { ShariahBadge } from '../components/ShariahBadge'
import { SortableTh } from '../components/SortableTh'
import { WeightModeToggle } from '../components/WeightModeToggle'
import { usePortfolioContext } from '../context/PortfolioContext'
import { useTableSort } from '../hooks/useTableSort'
import { indexLabel } from '../lib/index-labels'
import { filterByCompliance, formatPct, formatPkr, formatQty, withWeightMode } from '../lib/portfolio'
import type { BenchmarkIndex, ComparisonRow, ComplianceFilter, WeightMode } from '../types'

type CompareSortKey =
  | 'symbol'
  | 'name'
  | 'compliance'
  | 'indexWeight'
  | 'portfolioWeight'
  | 'drift'
  | 'quantity'
  | 'value'
  | 'indexPrice'

const compareAccessors: Record<
  CompareSortKey,
  (r: ComparisonRow) => string | number | boolean | null
> = {
  symbol: (r) => r.symbol,
  name: (r) => r.name,
  compliance: (r) => r.shariahCompliant,
  indexWeight: (r) => r.indexWeight,
  portfolioWeight: (r) => r.portfolioWeight,
  drift: (r) => r.drift,
  quantity: (r) => r.quantity,
  value: (r) => r.marketValue,
  indexPrice: (r) => r.indexPrice,
}

export function ComparePage() {
  const { comparison, benchmark, setBenchmarkIndex, loading, constituents, portfolioSettings } =
    usePortfolioContext()
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>('all')
  const [weightMode, setWeightMode] = useState<WeightMode>('actual')
  const { sortKey, sortDir, toggle, sort } = useTableSort<CompareSortKey>('drift', 'asc')

  const rule = portfolioSettings.rules[benchmark]
  const weightedComparison = useMemo(
    () => withWeightMode(comparison, weightMode),
    [comparison, weightMode],
  )

  const filtered = useMemo(
    () => filterByCompliance(weightedComparison, complianceFilter),
    [weightedComparison, complianceFilter],
  )
  const sorted = useMemo(() => sort(filtered, compareAccessors), [filtered, sort, sortKey, sortDir])

  if (loading) return <LoadingState />
  const shariahCount = weightedComparison.filter((r) => r.shariahCompliant).length
  const nonShariahCount = weightedComparison.length - shariahCount
  const refWeightLabel = weightMode === 'actual' ? 'Index wt' : 'Target wt'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Compare to index</h2>
          <p className="text-sm text-slate-400">
            KMI-30 stocks are Shariah compliant. KSE-100-only stocks are marked non-compliant.
          </p>
        </div>
          <div className="flex flex-wrap gap-2">
          <WeightModeToggle mode={weightMode} onChange={setWeightMode} />
          <div className="flex rounded-lg border border-slate-700 p-1">
            {(['KMI30', 'KSE100'] as BenchmarkIndex[]).map((code) => (
              <button
                key={code}
                onClick={() => setBenchmarkIndex(code)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  benchmark === code
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {code === 'KMI30' ? 'KMI-30' : 'KSE-100'}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-slate-700 p-1">
            {(
              [
                ['all', 'All'],
                ['shariah', 'Shariah'],
                ['non-shariah', 'Non-compliant'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setComplianceFilter(value)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  complianceFilter === value
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {shariahCount} Shariah compliant · {nonShariahCount} non-compliant
        {weightMode === 'preferred' && (
          <>
            {' '}
            · Preferred: top {rule.topNCount} get {rule.topNBudgetPct}% target (
            {indexLabel(benchmark)})
          </>
        )}
      </p>

      <Card
        title={`${benchmark === 'KMI30' ? 'KMI-30' : 'KSE-100'} comparison · ${
          weightMode === 'actual' ? 'actual index weights' : 'preferred targets'
        }`}
      >
        {constituents.length === 0 ? (
          <EmptyState message="No index data yet. Go to Index Data and sync from PSX." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <SortableTh label="Symbol" sortKey="symbol" activeKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortableTh label="Name" sortKey="name" activeKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortableTh label="Compliance" sortKey="compliance" activeKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortableTh label={refWeightLabel} sortKey="indexWeight" activeKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                  <SortableTh label="Your wt" sortKey="portfolioWeight" activeKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                  <SortableTh label="Drift" sortKey="drift" activeKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                  <SortableTh label="Qty" sortKey="quantity" activeKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                  <SortableTh label="Value" sortKey="value" activeKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                  <SortableTh label="Index price" sortKey="indexPrice" activeKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.symbol}
                    className={`border-t border-slate-800 ${
                      !row.shariahCompliant && row.actualIndexWeight > 0 ? 'bg-rose-500/5' : ''
                    } ${!row.owned && row.indexWeight > 0 && row.shariahCompliant ? 'bg-amber-500/5' : ''} ${
                      weightMode === 'preferred' && row.inTopN ? 'ring-1 ring-inset ring-emerald-500/20' : ''
                    }`}
                  >
                    <td className="py-2 font-medium">{row.symbol}</td>
                    <td className="max-w-[160px] truncate py-2 text-slate-400">{row.name}</td>
                    <td className="py-2">
                      <ShariahBadge compliant={row.shariahCompliant} />
                    </td>
                    <td className="py-2 text-right">{row.indexWeight.toFixed(2)}%</td>
                    <td className="py-2 text-right">{row.portfolioWeight.toFixed(2)}%</td>
                    <td
                      className={`py-2 text-right font-medium ${
                        row.drift < -0.5
                          ? 'text-amber-400'
                          : row.drift > 0.5
                            ? 'text-sky-400'
                            : 'text-slate-300'
                      }`}
                    >
                      {formatPct(row.drift)}
                    </td>
                    <td className="py-2 text-right text-slate-400">
                      {row.quantity > 0 ? formatQty(row.quantity) : '—'}
                    </td>
                    <td className="py-2 text-right">
                      {row.marketValue > 0 ? formatPkr(row.marketValue) : '—'}
                    </td>
                    <td className="py-2 text-right text-slate-400">{formatPkr(row.indexPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
