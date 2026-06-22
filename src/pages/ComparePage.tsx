import { useState } from 'react'
import { Card, EmptyState, LoadingState } from '../components/ui'
import { ShariahBadge } from '../components/ShariahBadge'
import { usePortfolioContext } from '../context/PortfolioContext'
import { filterByCompliance, formatPct, formatPkr, formatQty } from '../lib/portfolio'
import type { BenchmarkIndex, ComplianceFilter } from '../types'

export function ComparePage() {
  const { comparison, benchmark, setBenchmarkIndex, loading, constituents } = usePortfolioContext()
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>('all')

  if (loading) return <LoadingState />

  const filtered = filterByCompliance(comparison, complianceFilter)
  const shariahCount = comparison.filter((r) => r.shariahCompliant).length
  const nonShariahCount = comparison.length - shariahCount

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
        {shariahCount} Shariah compliant · {nonShariahCount} non-compliant in this index view
      </p>

      <Card title={`${benchmark === 'KMI30' ? 'KMI-30' : 'KSE-100'} comparison`}>
        {constituents.length === 0 ? (
          <EmptyState message="No index data yet. Go to Index Data and sync from PSX." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Compliance</th>
                  <th className="pb-2 text-right">Index wt</th>
                  <th className="pb-2 text-right">Your wt</th>
                  <th className="pb-2 text-right">Drift</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Value</th>
                  <th className="pb-2 text-right">Index price</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.symbol}
                    className={`border-t border-slate-800 ${
                      !row.shariahCompliant && row.indexWeight > 0 ? 'bg-rose-500/5' : ''
                    } ${!row.owned && row.indexWeight > 0 && row.shariahCompliant ? 'bg-amber-500/5' : ''}`}
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
