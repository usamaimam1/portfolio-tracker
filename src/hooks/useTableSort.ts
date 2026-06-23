import { useCallback, useState } from 'react'

export type SortDir = 'asc' | 'desc'
type SortValue = string | number | boolean | null | undefined

function compareValues(a: SortValue, b: SortValue, dir: SortDir): number {
  const mult = dir === 'asc' ? 1 : -1

  const aNull = a === null || a === undefined
  const bNull = b === null || b === undefined
  if (aNull && bNull) return 0
  if (aNull) return 1
  if (bNull) return -1

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return mult * (Number(a) - Number(b))
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return mult * (a - b)
  }
  return mult * String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function sortBy<T>(rows: T[], getValue: (row: T) => SortValue, dir: SortDir): T[] {
  return [...rows].sort((a, b) => compareValues(getValue(a), getValue(b), dir))
}

export function useTableSort<K extends string>(defaultKey: K, defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<K>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  const toggle = useCallback(
    (key: K) => {
      if (sortKey === key) {
        setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir(defaultDir)
      }
    },
    [sortKey, defaultDir],
  )

  const sort = useCallback(
    <T>(rows: T[], accessors: Record<K, (row: T) => SortValue>) => {
      return sortBy(rows, accessors[sortKey], sortDir)
    },
    [sortKey, sortDir],
  )

  return { sortKey, sortDir, toggle, sort }
}
