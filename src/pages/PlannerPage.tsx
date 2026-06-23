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

type BuySortKey = 'symbol' | 'shares' | 'price' | 'cost' | 'driftAfter'

const buyAccessors: Record<BuySortKey, (s: ShareBuySuggestion) => string | number> = {
  symbol: (s) => s.symbol,
  shares: (s) => s.shares,
  price: (s) => s.pricePerShare,
  cost: (s) => s.totalCost,
  driftAfter: (s) => s.driftAfter,
}

export function PlannerPage() {
  const { loading, suggestInvest, portfolioSettings } = usePortfolioContext()
  const [investAmount, setInvestAmount] = useState(50000)
  const buyPlan = suggestInvest(investAmount)
  const buySort = useTableSort<BuySortKey>('cost', 'desc')
  const constraints = getPlannerConstraints(portfolioSettings)

  const sortedBuys = useMemo(
    () => buySort.sort(buyPlan.suggestions, buyAccessors),
    [buyPlan.suggestions, buySort.sort],
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
            <p className="mt-1 text-xs text-slate-500">Budget share for largest constituents</p>
          </Card>
          <Card title="Index concentration">
            <p className="text-lg font-semibold text-emerald-400">
              {buyPlan.topNMetrics.indexTopNWeightPct.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Top {buyPlan.topNMetrics.topNCount} weight in {indexLabel(portfolioSettings.primaryIndex)}
            </p>
          </Card>
          <Card title="Your portfolio">
            <p className="text-lg font-semibold text-slate-200">
              {buyPlan.topNMetrics.portfolioTopNWeightPct.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-slate-500">Current holdings in top N</p>
          </Card>
          <Card title="This plan">
            <p className="text-lg font-semibold text-amber-400">
              {buyPlan.topNMetrics.plannedTopNSpendPct.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Spend going to top {constraints.topNCount} (target {constraints.topNBudgetPct}%)
            </p>
          </Card>
        </div>
      )}

      <Card title={`Invest this month (${indexLabel(portfolioSettings.primaryIndex)} · whole shares)`}>
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

            <p className="text-xs text-slate-500">
              Whole shares only. {constraints.topNBudgetPct}% of budget targets the top{' '}
              {constraints.topNCount} {indexLabel(portfolioSettings.primaryIndex)} names; the rest
              spreads across other index stocks.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <SortableTh label="Buy" sortKey="symbol" activeKey={buySort.sortKey} sortDir={buySort.sortDir} onSort={buySort.toggle} />
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
                      <td className="py-2 text-right font-medium text-emerald-300">
                        {formatQty(s.shares)}
                      </td>
                      <td className="py-2 text-right text-slate-400">
                        {formatPrice(s.pricePerShare)}
                      </td>
                      <td className="py-2 text-right">{formatPkr(s.totalCost)}</td>
                      <td
                        className={`py-2 text-right ${
                          s.driftAfter < -0.25
                            ? 'text-amber-400'
                            : s.driftAfter > 0.25
                              ? 'text-sky-400'
                              : 'text-emerald-400'
                        }`}
                      >
                        {formatPct(s.driftAfter)}
                      </td>
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
