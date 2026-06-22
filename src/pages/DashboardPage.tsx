import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatCards } from '../components/StatCard'
import { Card, EmptyState, ErrorBanner, LoadingState } from '../components/ui'
import { usePortfolioContext } from '../context/PortfolioContext'
import { formatPct, formatPrice, formatPkr, formatQty } from '../lib/portfolio'

export function DashboardPage() {
  const {
    summary,
    compliance,
    holdings,
    kmi30Comparison,
    benchmark,
    loading,
    error,
    syncs,
    syncing,
    syncIndexes,
    suggestInvest,
  } = usePortfolioContext()

  const [investAmount, setInvestAmount] = useState(50000)
  const buyPlan = suggestInvest(investAmount)
  const topDrift = kmi30Comparison
    .filter((r) => r.indexWeight > 0 && r.shariahCompliant)
    .slice(0, 5)
  const lastSync = syncs.find((s) => s.index_code === benchmark)

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Top underweight (Shariah)">
          {topDrift.length === 0 ? (
            <EmptyState message="Sync index data from PSX to see drift." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2 text-right">Index</th>
                  <th className="pb-2 text-right">Yours</th>
                  <th className="pb-2 text-right">Drift</th>
                </tr>
              </thead>
              <tbody>
                {topDrift.map((row) => (
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

        <Card title="Invest this month (KMI-30 · whole shares)">
          <label className="block text-sm text-slate-400">
            Budget (PKR)
            <input
              type="number"
              min={0}
              step={1000}
              value={investAmount}
              onChange={(e) => setInvestAmount(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>

          {buyPlan.suggestions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              {buyPlan.message ?? 'Sync indexes and add holdings to get suggestions.'}
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-950/60 p-3 text-center text-sm">
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
                Whole shares only. Leftover cash and any remaining gap carry into your next cycle.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2">Buy</th>
                      <th className="pb-2 text-right">Shares</th>
                      <th className="pb-2 text-right">Price</th>
                      <th className="pb-2 text-right">Cost</th>
                      <th className="pb-2 text-right">Drift after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyPlan.suggestions.map((s) => (
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
                <th className="pb-2">Symbol</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Value</th>
                <th className="pb-2 text-right">Weight</th>
              </tr>
            </thead>
            <tbody>
              {holdings.slice(0, 5).map((h) => (
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
