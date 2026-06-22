import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatPrice } from '../lib/portfolio'

export interface SymbolOption {
  symbol: string
  name: string
  price: number
  shariahCompliant: boolean
}

interface SymbolComboboxProps {
  options: SymbolOption[]
  value: string
  onChange: (symbol: string, option: SymbolOption | null) => void
  disabled?: boolean
  placeholder?: string
}

export function SymbolCombobox({
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Search by symbol or name…',
}: SymbolComboboxProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const selected = options.find((o) => o.symbol === value) ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => {
      const symbol = o.symbol.toLowerCase()
      const name = o.name.toLowerCase()
      return (
        symbol.includes(q) ||
        name.includes(q) ||
        name.split(/\s+/).some((word) => word.startsWith(q))
      )
    })
  }, [options, query])

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const pick = (option: SymbolOption) => {
    onChange(option.symbol, option)
    setQuery('')
    setOpen(false)
  }

  const displayValue = open ? query : (selected?.symbol ?? value)

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled || options.length === 0}
        value={displayValue}
        placeholder={options.length === 0 ? 'Sync indexes to load symbols' : placeholder}
        onFocus={() => {
          setOpen(true)
          setQuery(selected?.symbol ?? value)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange('', null)
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            setOpen(true)
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight((i) => Math.min(i + 1, filtered.length - 1))
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((i) => Math.max(i - 1, 0))
          }
          if (e.key === 'Enter' && open && filtered[highlight]) {
            e.preventDefault()
            pick(filtered[highlight])
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500"
        autoComplete="off"
      />

      {open && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl"
        >
          {filtered.map((option, i) => (
            <li key={option.symbol} role="option" aria-selected={option.symbol === value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(option)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                  i === highlight ? 'bg-emerald-500/15' : 'hover:bg-slate-800'
                }`}
              >
                <span className="font-medium text-slate-100">{option.symbol}</span>
                <span className="text-slate-400">{formatPrice(option.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && query && filtered.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-400 shadow-xl">
          No matching symbols. Sync indexes or try another search.
        </p>
      )}
    </div>
  )
}
