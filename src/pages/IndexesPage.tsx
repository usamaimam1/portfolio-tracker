import { useMemo } from 'react'
import { Card, EmptyState, ErrorBanner, LoadingState } from '../components/ui'
import { SortableTh } from '../components/SortableTh'
import { usePortfolioContext } from '../context/PortfolioContext'
import { useTableSort } from '../hooks/useTableSort'
import { indexLabel } from '../lib/index-labels'
import { formatPrice } from '../lib/portfolio'
import type { IndexSync } from '../types'

type SyncSortKey = 'index' | 'syncedAt'

const syncAccessors: Record<SyncSortKey, (s: IndexSync) => string> = {
  index: (s) => indexLabel(s.index_code),
  syncedAt: (s) => s.synced_at,
}

export function IndexesPage() {
  const {
    syncs,
    syncing,
    syncIndexes,
    syncListings,
    error,
    prices,
    loading,
    uncoveredHoldings,
  } = usePortfolioContext()

  const { sortKey, sortDir, toggle, sort } = useTableSort<SyncSortKey>('syncedAt', 'desc')
  const sortedSyncs = useMemo(() => sort(syncs, syncAccessors), [syncs, sort])

  if (loading) return <LoadingState />

  const kmiSync = syncs.find((s) => s.index_code === 'KMI30')
  const kseSync = syncs.find((s) => s.index_code === 'KSE100')
  const allShrSync = syncs.find((s) => s.index_code === 'ALLSHR')
  const kmiAllShrSync = syncs.find((s) => s.index_code === 'KMIALLSHR')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Index data</h2>
          <p className="text-sm text-slate-400">
            Pulls live constituents and prices from{' '}
            <a
              href="https://dps.psx.com.pk/indices/KMI30"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline"
            >
              PSX DPS
            </a>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => syncIndexes()}
            disabled={syncing !== null}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {syncing === 'benchmark' ? 'Syncing benchmarks…' : 'Sync KMI-30 & KSE-100'}
          </button>
          <button
            onClick={() => syncListings()}
            disabled={syncing !== null}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {syncing === 'listings' ? 'Syncing listings…' : 'Sync All Share listings'}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="KMI-30">
          {kmiSync ? (
            <p className="text-sm text-slate-300">
              Last synced: {new Date(kmiSync.synced_at).toLocaleString()}
            </p>
          ) : (
            <EmptyState message="Not synced yet." />
          )}
        </Card>
        <Card title="KSE-100">
          {kseSync ? (
            <p className="text-sm text-slate-300">
              Last synced: {new Date(kseSync.synced_at).toLocaleString()}
            </p>
          ) : (
            <EmptyState message="Not synced yet." />
          )}
        </Card>
        <Card title="Stock prices">
          <p className="text-3xl font-semibold text-emerald-400">{prices.length}</p>
          <p className="mt-1 text-sm text-slate-400">symbols with latest prices</p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="KSE All Share (ALLSHR)">
          <p className="mb-2 text-xs text-slate-500">
            Full PSX listing — covers holdings outside KMI-30 and KSE-100.
          </p>
          {allShrSync ? (
            <p className="text-sm text-slate-300">
              Last synced: {new Date(allShrSync.synced_at).toLocaleString()}
            </p>
          ) : (
            <EmptyState message="Not synced yet. Use “Sync All Share listings”." />
          )}
        </Card>
        <Card title="KMI All Share (KMIALLSHR)">
          <p className="mb-2 text-xs text-slate-500">
            All Shariah-compliant listings — used for compliance tags on full sync.
          </p>
          {kmiAllShrSync ? (
            <p className="text-sm text-slate-300">
              Last synced: {new Date(kmiAllShrSync.synced_at).toLocaleString()}
            </p>
          ) : (
            <EmptyState message="Not synced yet. Use “Sync All Share listings”." />
          )}
        </Card>
      </div>

      {uncoveredHoldings.length > 0 && (
        <Card title="Holdings outside KMI-30 & KSE-100">
          <p className="mb-3 text-sm text-slate-400">
            These symbols are in your portfolio but not part of the benchmark indices. Sync All
            Share listings to pull their prices.
          </p>
          <div className="flex flex-wrap gap-2">
            {uncoveredHoldings.map((h) => (
              <span
                key={h.symbol}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
              >
                <span className="font-medium text-slate-200">{h.symbol}</span>
                {h.currentPrice != null ? (
                  <span className="ml-2 text-slate-400">{formatPrice(h.currentPrice)}</span>
                ) : (
                  <span className="ml-2 text-amber-400">no price</span>
                )}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card title="Sync history">
        {syncs.length === 0 ? (
          <EmptyState message="No syncs yet. Click a sync button above to fetch from PSX." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <SortableTh label="Index" sortKey="index" activeKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortableTh label="Synced at" sortKey="syncedAt" activeKey={sortKey} sortDir={sortDir} onSort={toggle} />
              </tr>
            </thead>
            <tbody>
              {sortedSyncs.map((s) => (
                <tr key={s.id} className="border-t border-slate-800">
                  <td className="py-2">{indexLabel(s.index_code)}</td>
                  <td className="py-2 text-slate-400">{new Date(s.synced_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
