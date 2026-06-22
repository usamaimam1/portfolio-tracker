export function ShariahBadge({ compliant }: { compliant: boolean }) {
  if (compliant) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
        Shariah
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-700/50 px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-slate-600">
      Non-compliant
    </span>
  )
}
