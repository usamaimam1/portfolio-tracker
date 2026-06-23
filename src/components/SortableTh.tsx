import type { SortDir } from '../hooks/useTableSort'

interface SortableThProps<K extends string> {
  label: string
  sortKey: K
  activeKey: K
  sortDir: SortDir
  onSort: (key: K) => void
  align?: 'left' | 'right'
}

export function SortableTh<K extends string>({
  label,
  sortKey,
  activeKey,
  sortDir,
  onSort,
  align = 'left',
}: SortableThProps<K>) {
  const active = activeKey === sortKey

  return (
    <th className={`pb-2 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group inline-flex items-center gap-1 hover:text-slate-300 ${
          active ? 'text-slate-300' : ''
        } ${align === 'right' ? 'float-right' : ''}`}
      >
        <span>{label}</span>
        <span className={`text-xs ${active ? 'text-emerald-400' : 'text-slate-600 group-hover:text-slate-500'}`}>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}
