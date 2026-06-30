import { useEffect, useMemo, useState } from 'react'
import { Card, ErrorBanner, LoadingState } from '../components/ui'
import { usePortfolioContext } from '../context/PortfolioContext'
import { indexLabel } from '../lib/index-labels'
import {
  computeCustomBucketMetrics,
  computeTopNIndexMetrics,
  getTopNSymbolsFromConstituents,
  type IndexPortfolioRule,
  type PortfolioSettings,
  type RestDistribution,
} from '../lib/portfolio-settings'
import type { BenchmarkIndex, Holding, IndexConstituent } from '../types'
import { formatPct, portfolioTopNWeight } from '../lib/portfolio'

const BENCHMARK_INDEXES: BenchmarkIndex[] = ['KMI30', 'KSE100']

function CustomBucketSection({
  rule,
  holdings,
  topNSymbols,
  onChange,
}: {
  rule: IndexPortfolioRule
  holdings: Holding[]
  topNSymbols: Set<string>
  onChange: (patch: Partial<IndexPortfolioRule>) => void
}) {
  const metrics = useMemo(
    () => computeCustomBucketMetrics(holdings, rule, topNSymbols),
    [holdings, rule, topNSymbols],
  )

  const setCustomWeight = (symbol: string, value: number) => {
    onChange({
      customRestWeights: { ...rule.customRestWeights, [symbol]: value },
    })
  }

  const customSum = metrics.symbols.reduce(
    (sum, sym) => sum + (rule.customRestWeights[sym] ?? 0),
    0,
  )

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-300">Custom portfolio bucket</p>
        <div className="flex gap-1">
          {(['equal', 'custom'] as RestDistribution[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ restDistribution: mode })}
              className={`rounded px-2 py-1 text-xs capitalize ${
                rule.restDistribution === mode
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-700 text-slate-400'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Remaining {formatPct(100 - rule.topNBudgetPct, 0)} split across{' '}
        <span className="text-slate-300">{metrics.symbolCount}</span> owned holding(s) outside top{' '}
        {rule.topNCount} (includes off-index).
        {metrics.symbolCount > 0 && rule.restDistribution === 'equal' && (
          <span className="text-emerald-400">
            {' '}
            → {metrics.equalWeightPct.toFixed(2)}% each
          </span>
        )}
      </p>

      {metrics.symbolCount === 0 ? (
        <p className="text-xs text-slate-500">No custom holdings yet — add positions outside top N.</p>
      ) : rule.restDistribution === 'custom' ? (
        <div className="space-y-2">
          {metrics.symbols.map((symbol) => (
            <label key={symbol} className="flex items-center gap-2 text-sm">
              <span className="w-16 font-medium text-slate-300">{symbol}</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={rule.customRestWeights[symbol] ?? 0}
                onChange={(e) => setCustomWeight(symbol, Number(e.target.value))}
                className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
              <span className="text-slate-500">% of remainder</span>
            </label>
          ))}
          <p
            className={`text-xs ${Math.abs(customSum - 100) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            Weights sum: {customSum.toFixed(1)}% (target 100%)
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {metrics.symbols.map((symbol) => (
            <span
              key={symbol}
              className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200"
            >
              {symbol}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

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

  const topNSymbols = useMemo(
    () => getTopNSymbolsFromConstituents(constituents, rule.topNCount),
    [constituents, rule.topNCount],
  )
  const yourTopNWeight = portfolioTopNWeight(holdings, topNSymbols)

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
              </div>
              <div>
                <p className="text-xs text-slate-500">Your portfolio in top {rule.topNCount}</p>
                <p className="text-lg font-semibold text-slate-200">
                  {yourTopNWeight.toFixed(2)}%
                </p>
              </div>
            </div>

            <CustomBucketSection
              rule={rule}
              holdings={holdings}
              topNSymbols={topNSymbols}
              onChange={onChange}
            />
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="text-sm text-slate-400">
            Top N gets a budget share; the remainder goes to your other holdings (including
            off-index).
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
          {formatPct(primaryRule.topNBudgetPct, 0)} to top {primaryRule.topNCount} ·{' '}
          {formatPct(100 - primaryRule.topNBudgetPct, 0)} to custom holdings (
          {computeCustomBucketMetrics(
            holdings,
            primaryRule,
            getTopNSymbolsFromConstituents(
              constituentsByIndex[draft.primaryIndex],
              primaryRule.topNCount,
            ),
          ).symbolCount}{' '}
          symbols)
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
