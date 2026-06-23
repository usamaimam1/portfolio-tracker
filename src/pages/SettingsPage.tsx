import { useEffect, useMemo, useState } from 'react'
import { Card, ErrorBanner, LoadingState } from '../components/ui'
import { usePortfolioContext } from '../context/PortfolioContext'
import { indexLabel } from '../lib/index-labels'
import {
  computeTopNIndexMetrics,
  type IndexPortfolioRule,
  type PortfolioSettings,
} from '../lib/portfolio-settings'
import type { BenchmarkIndex } from '../types'
import { formatPct, portfolioTopNWeight } from '../lib/portfolio'

import type { Holding, IndexConstituent } from '../types'

const BENCHMARK_INDEXES: BenchmarkIndex[] = ['KMI30', 'KSE100']

function IndexRuleCard({
  indexCode,
  rule,
  constituents,
  holdings,
  onChange,
}: {
  indexCode: BenchmarkIndex
  rule: IndexPortfolioRule
  constituents: IndexConstituent[]
  holdings: Holding[]
  onChange: (patch: Partial<IndexPortfolioRule>) => void
}) {
  const metrics = useMemo(
    () => computeTopNIndexMetrics(constituents, rule.topNCount),
    [constituents, rule.topNCount],
  )

  const topSymbols = useMemo(() => new Set(metrics.symbols), [metrics.symbols])
  const yourTopNWeight = portfolioTopNWeight(holdings, topSymbols)

  return (
    <Card title={indexLabel(indexCode)}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-400">Top N companies</span>
            <input
              type="number"
              min={1}
              max={30}
              value={rule.topNCount}
              onChange={(e) => onChange({ topNCount: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Budget to top N (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={rule.topNBudgetPct}
              onChange={(e) => onChange({ topNBudgetPct: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
        </div>

        {constituents.length === 0 ? (
          <p className="text-sm text-slate-500">Sync this index from Index Data to see weights.</p>
        ) : (
          <>
            <div className="grid gap-3 rounded-lg bg-slate-950/60 p-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Top {rule.topNCount} index weight</p>
                <p className="text-lg font-semibold text-emerald-400">
                  {metrics.indexWeightPct.toFixed(2)}%
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Combined weight of the largest {rule.topNCount} in {indexLabel(indexCode)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Your portfolio in top {rule.topNCount}</p>
                <p className="text-lg font-semibold text-slate-200">
                  {yourTopNWeight.toFixed(2)}%
                </p>
                <p className="mt-1 text-xs text-slate-500">Current holdings concentration</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-slate-500">
                Top {rule.topNCount} symbols ({metrics.indexWeightPct.toFixed(1)}% of index)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {metrics.symbols.map((symbol) => (
                  <span
                    key={symbol}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-medium text-slate-300"
                  >
                    {symbol}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

export function SettingsPage() {
  const {
    loading,
    portfolioSettings,
    constituentsByIndex,
    holdings,
    settingsSaving,
    savePortfolioSettings,
  } = usePortfolioContext()

  const [draft, setDraft] = useState<PortfolioSettings>(portfolioSettings)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDraft(portfolioSettings)
  }, [portfolioSettings])

  const updateRule = (code: BenchmarkIndex, patch: Partial<IndexPortfolioRule>) => {
    setDraft((prev) => ({
      ...prev,
      rules: {
        ...prev.rules,
        [code]: { ...prev.rules[code], ...patch },
      },
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaveError(null)
    const { error } = await savePortfolioSettings(draft)
    if (error) {
      setSaveError(error)
      return
    }
    setSaved(true)
  }

  if (loading) return <LoadingState />

  const primaryRule = draft.rules[draft.primaryIndex]
  const primaryMetrics = computeTopNIndexMetrics(
    constituentsByIndex[draft.primaryIndex],
    primaryRule.topNCount,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="text-sm text-slate-400">
            Configure portfolio concentration rules per index. The planner uses your primary index.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={settingsSaving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {settingsSaving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      {saveError && <ErrorBanner message={saveError} />}
      {saved && (
        <p className="text-sm text-emerald-400">Settings saved. Planner will use the new rules.</p>
      )}

      <Card title="Primary index (planner target)">
        <div className="flex flex-wrap gap-2">
          {BENCHMARK_INDEXES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setDraft((prev) => ({ ...prev, primaryIndex: code }))
                setSaved(false)
              }}
              className={`rounded-lg px-4 py-2 text-sm ${
                draft.primaryIndex === code
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {indexLabel(code)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Investment planner targets{' '}
          <span className="text-slate-200">{indexLabel(draft.primaryIndex)}</span> with{' '}
          <span className="text-slate-200">{formatPct(primaryRule.topNBudgetPct, 0)}</span> of
          each budget in the top{' '}
          <span className="text-slate-200">{primaryRule.topNCount}</span> (covering{' '}
          <span className="text-emerald-400">{primaryMetrics.indexWeightPct.toFixed(1)}%</span> of
          the index).
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {BENCHMARK_INDEXES.map((code) => (
          <IndexRuleCard
            key={code}
            indexCode={code}
            rule={draft.rules[code]}
            constituents={constituentsByIndex[code]}
            holdings={holdings}
            onChange={(patch) => updateRule(code, patch)}
          />
        ))}
      </div>
    </div>
  )
}
