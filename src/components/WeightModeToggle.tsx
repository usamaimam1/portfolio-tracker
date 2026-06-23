import type { WeightMode } from '../types'

export function WeightModeToggle({
  mode,
  onChange,
}: {
  mode: WeightMode
  onChange: (mode: WeightMode) => void
}) {
  return (
    <div className="flex rounded-lg border border-slate-700 p-1">
      <button
        type="button"
        onClick={() => onChange('actual')}
        className={`rounded-md px-3 py-1.5 text-sm ${
          mode === 'actual'
            ? 'bg-slate-700 text-slate-100'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        Actual index
      </button>
      <button
        type="button"
        onClick={() => onChange('preferred')}
        className={`rounded-md px-3 py-1.5 text-sm ${
          mode === 'preferred'
            ? 'bg-emerald-600 text-white'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        Preferred target
      </button>
    </div>
  )
}
