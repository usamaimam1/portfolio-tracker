import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SortableTh } from '../components/SortableTh'
import { Card, LoadingState } from '../components/ui'
import { usePortfolioContext } from '../context/PortfolioContext'
import { useTableSort } from '../hooks/useTableSort'
import { indexLabel } from '../lib/index-labels'
import { getPlannerConstraints } from '../lib/portfolio-settings'
import { formatPct, formatPrice, formatPkr, formatQty } from '../lib/portfolio'
import type { ShareBuySuggestion } from '../types'

type BuySortKey = 'symbol' | 'shares' | 'price' | 'cost' | 'driftAfter' | 'bucket'

const buyAccessors: Record<BuySortKey, (s: ShareBuySuggestion & { bucket: string }) => string | number> = {
  symbol: (s) => s.symbol,
  shares: (s) => s.shares,
  price: (s) => s.pricePerShare,
  cost: (s) => s.totalCost,
  driftAfter: (s) => s.driftAfter,
  bucket: (s) => s.bucket,
}

export function PlannerPage() {
  const { loading, suggestInvest, portfolioSettings, primaryComparison } = usePortfolioContext()
  const [investAmount, setInvestAmount] = useState(50000)
  const [includeCustomHoldings, setIncludeCustomHoldings] = useState(false)
  const buyPlan = suggestInvest(investAmount, includeCustomHoldings)
  const buySort = useTableSort<BuySortKey>('cost', 'desc')
  const constraints = getPlannerConstraints(portfolioSettings)

  const customSymbolSet = useMemo(
    () => new Set(primaryComparison.filter((r) => r.inCustomBucket).map((r) => r.symbol)),
    [primaryComparison],
  )

  const enrichedBuys = useMemo(
    () =>
      buyPlan.suggestions.map((s) => ({
        ...s,
        bucket: customSymbolSet.has(s.symbol) ? 'Custom' : 'Top N',
      })),
    [buyPlan.suggestions, customSymbolSet],
  )

  const sortedBuys = useMemo(
    () => buySort.sort(enrichedBuys, buyAccessors),
    [enrichedBuys, buySort.sort],
  )

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Investment planner</h2>
        <p className="text-sm text-slate-400">
          Allocate toward underweight {indexLabel(portfolioSettings.primaryIndex)} stocks — whole
          shares, Shariah-compliant.{' '}
          <Link to="/settings" className="text-emerald-400 hover:underline">
            Adjust rules in Settings
          </Link>
          .
        </p>
      </div>

      {buyPlan.topNMetrics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Top N rule">
            <p className="text-lg font-semibold text-slate-200">
              Top {buyPlan.topNMetrics.topNCount} · {buyPlan.topNMetrics.topNBudgetPct}%
            </p>
          </Card>
          <Card title="Index concentration">
            <p className="text-lg font-semibold text-emerald-400">
              {buyPlan.topNMetrics.indexTopNWeightPct.toFixed(1)}%
            </p>
          </Card>
          <Card title="Your portfolio">
            <p className="text-lg font-semibold text-slate-200">
              {buyPlan.topNMetrics.portfolioTopNWeightPct.toFixed(1)}%
            </p>
          </Card>
          <Card title="This plan">
            <p className="text-lg font-semibold text-amber-400">
              {buyPlan.topNMetrics.plannedTopNSpendPct.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-slate-500">Spend to top N</p>
          </Card>
        </div>
      )}

      {buyPlan.customMetrics && (
        <Card title="Custom portfolio bucket">
          <p className="text-sm text-slate-400">
            Remainder budget: {buyPlan.customMetrics.restBudgetPct}% across{' '}
            {buyPlan.customMetrics.symbolCount} holding(s).
            {includeCustomHoldings ? (
              <span className="text-emerald-400">
                {' '}
                Planned custom spend: {buyPlan.customMetrics.plannedCustomSpendPct.toFixed(1)}%
              </span>
            ) : (
              <span className="text-slate-500"> Enable the toggle below to include in this plan.</span>
            )}
          </p>
        </Card>
      )}

      <Card title={`Invest this month (${indexLabel(portfolioSettings.primaryIndex)} · whole shares)`}>
        <div className="space-y-4">
          <label className="block text-sm text-slate-400">
            Budget (PKR)
            <input
              type="number"
              min={0}
              step={1000}
              value={investAmount}
              onChange={(e) => setInvestAmount(Number(e.target.value))}
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={includeCustomHoldings}
              onChange={(e) => setIncludeCustomHoldings(e.target.checked)}
              className="rounded border-slate-600"
            />
            Include custom portfolio holdings ({100 - constraints.topNBudgetPct}% remainder bucket)
          </label>
        </div>

        {buyPlan.suggestions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            {buyPlan.message ?? 'Sync indexes and add holdings to get suggestions.'}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-950/60 p-3 text-center text-sm sm:max-w-md">
              <div>
                <p className="text-slate-500">Spend</p>
                <p className="font-medium text-emerald-400">{formatPkr(buyPlan.totalSpend)}</p>
              </div>
              <div>
                <p className="text-slate-500">Leftover</p>
                <p className="font-medium text-amber-400">{formatPkr(buyPlan.leftover)}</p>
              </div>
              <div>
                <p className="text-slate-500">Orders</p>
                <p className="font-medium">{buyPlan.suggestions.length}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <SortableTh label="Buy" sortKey="symbol" activeKey={buySort.sortKey} sortDir={buySort.sortDir} onSort={buySort.toggle} />
                    <SortableTh label="Bucket" sortKey="bucket" activeKey={buySort.sortKey} sortDir={buySort.sortDir} onSort={buySort.toggle} />
                    <SortableTh label="Shares" sortKey="shares" activeKey={buySort.sortKey} sortDir={buySort.sortDir} onSort={buySort.toggle} align="right" />
                    <SortableTh label="Price" sortKey="price" activeKey={buySort.sortKey} sortDir={buySort.sortDir} onSort={buySort.toggle} align="right" />
                    <SortableTh label="Cost" sortKey="cost" activeKey={buySort.sortKey} sortDir={buySort.sortDir} onSort={buySort.toggle} align="right" />
                    <SortableTh label="Drift after" sortKey="driftAfter" activeKey={buySort.sortKey} sortDir={buySort.sortDir} onSort={buySort.toggle} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedBuys.map((s) => (
                    <tr key={s.symbol} className="border-t border-slate-800">
                      <td className="py-2">
                        <span className="font-medium">{s.symbol}</span>
                        <span className="ml-1 text-slate-500">{s.name}</span>
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            s.bucket === 'Custom'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {s.bucket}
                        </span>
                      </td>
                      <td className="py-2 text-right font-medium text-emerald-300">
                        {formatQty(s.shares)}
                      </td>
                      <td className="py-2 text-right text-slate-400">
                        {formatPrice(s.pricePerShare)}
                      </td>
                      <td className="py-2 text-right">{formatPkr(s.totalCost)}</td>
                      <td className="py-2 text-right">{formatPct(s.driftAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
