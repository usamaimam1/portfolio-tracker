import { formatPct, formatPkr } from '../lib/portfolio'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'positive' | 'negative'
}

export function StatCard({ label, value, sub, tone = 'default' }: StatCardProps) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-400'
      : tone === 'negative'
        ? 'text-rose-400'
        : 'text-slate-100'

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
    </div>
  )
}

export function StatCards({
  totalValue,
  totalCost,
  unrealizedPnl,
  holdingCount,
}: {
  totalValue: number
  totalCost: number
  unrealizedPnl: number
  holdingCount: number
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Portfolio Value" value={formatPkr(totalValue)} />
      <StatCard label="Cost Basis" value={formatPkr(totalCost)} />
      <StatCard
        label="Unrealized P&L"
        value={formatPkr(unrealizedPnl)}
        tone={unrealizedPnl >= 0 ? 'positive' : 'negative'}
        sub={totalCost > 0 ? formatPct((unrealizedPnl / totalCost) * 100) : undefined}
      />
      <StatCard label="Holdings" value={String(holdingCount)} sub="active positions" />
    </div>
  )
}
