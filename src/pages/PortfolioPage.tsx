import { useState } from 'react'
import { Card, EmptyState, LoadingState } from '../components/ui'
import { ShariahBadge } from '../components/ShariahBadge'
import { usePortfolioContext } from '../context/PortfolioContext'
import { filterByCompliance, formatPct, formatPkr, formatQty } from '../lib/portfolio'
import type { ComplianceFilter } from '../types'

export function PortfolioPage() {
  const { holdings, summary, compliance, loading } = usePortfolioContext()
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>('all')

  if (loading) return <LoadingState />

  const filtered = filterByCompliance(holdings, complianceFilter)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Holdings</h2>
          <p className="text-sm text-slate-400">
            {holdings.length} positions · {formatPkr(summary.totalValue)} total value
          </p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Shariah compliant">
          <p className="text-2xl font-semibold text-emerald-400">
            {compliance.compliantWeight.toFixed(1)}%
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {formatPkr(compliance.compliantValue)} · {compliance.compliantCount} holdings
          </p>
        </Card>
        <Card title="Non-compliant exposure">
          <p
            className={`text-2xl font-semibold ${
              compliance.nonCompliantWeight > 0 ? 'text-rose-400' : 'text-slate-400'
            }`}
          >
            {compliance.nonCompliantWeight.toFixed(1)}%
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {formatPkr(compliance.nonCompliantValue)} · {compliance.nonCompliantCount} holdings
          </p>
        </Card>
      </div>

      <Card title="Your portfolio">
        {filtered.length === 0 ? (
          <EmptyState message="No holdings match this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Compliance</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Avg cost</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">Value</th>
                  <th className="pb-2 text-right">Weight</th>
                  <th className="pb-2 text-right">P&L</th>
                  <th className="pb-2 text-right">Day</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr
                    key={h.symbol}
                    className={`border-t border-slate-800 ${!h.shariahCompliant ? 'bg-rose-500/5' : ''}`}
                  >
                    <td className="py-2.5 font-medium">{h.symbol}</td>
                    <td className="py-2.5">
                      <ShariahBadge compliant={h.shariahCompliant} />
                    </td>
                    <td className="py-2.5 text-right text-slate-300">{formatQty(h.quantity)}</td>
                    <td className="py-2.5 text-right text-slate-400">{formatPkr(h.avgCost)}</td>
                    <td className="py-2.5 text-right">
                      {h.currentPrice !== null ? formatPkr(h.currentPrice) : '—'}
                    </td>
                    <td className="py-2.5 text-right">{formatPkr(h.marketValue)}</td>
                    <td className="py-2.5 text-right">{h.portfolioWeight.toFixed(2)}%</td>
                    <td
                      className={`py-2.5 text-right ${
                        h.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatPkr(h.unrealizedPnl)}
                    </td>
                    <td
                      className={`py-2.5 text-right ${
                        h.dayChangePct !== null && h.dayChangePct >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {h.dayChangePct !== null ? formatPct(h.dayChangePct) : '—'}
                    </td>
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
