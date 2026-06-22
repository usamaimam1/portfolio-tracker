import { useMemo, useState } from 'react'
import { SymbolCombobox } from '../components/SymbolCombobox'
import { Card, EmptyState, ErrorBanner, LoadingState } from '../components/ui'
import { usePortfolioContext } from '../context/PortfolioContext'
import { formatPkr, formatQty } from '../lib/portfolio'
import type { TransactionType } from '../types'

export function TransactionsPage() {
  const { transactions, prices, loading, error, addTransaction, deleteTransaction } =
    usePortfolioContext()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [symbol, setSymbol] = useState('')
  const [type, setType] = useState<TransactionType>('buy')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fees, setFees] = useState('0')
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const symbolOptions = useMemo(
    () =>
      [...prices]
        .map((p) => ({
          symbol: p.symbol,
          name: p.name ?? p.symbol,
          price: typeof p.price === 'string' ? parseFloat(p.price) : p.price,
          shariahCompliant: p.shariah_compliant ?? false,
        }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [prices],
  )

  const handleSymbolChange = (next: string, option: (typeof symbolOptions)[number] | null) => {
    setSymbol(next)
    if (option) setPrice(String(option.price))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    const match = symbolOptions.find((o) => o.symbol === symbol)
    if (!match) {
      setFormError('Select a symbol from the list.')
      setSubmitting(false)
      return
    }

    const { error: insertError } = await addTransaction({
      symbol: match.symbol,
      type,
      quantity: parseFloat(quantity),
      price_per_share: parseFloat(price),
      fees: parseFloat(fees) || 0,
      trade_date: tradeDate,
      notes: notes || null,
    })

    if (insertError) {
      setFormError(insertError)
    } else {
      setSymbol('')
      setQuantity('')
      setPrice('')
      setFees('0')
      setNotes('')
    }
    setSubmitting(false)
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Transactions</h2>
        <p className="text-sm text-slate-400">
          Log buys and sells. Symbols come from your latest PSX index sync.
        </p>
      </div>

      {(error || formError) && <ErrorBanner message={formError ?? error ?? ''} />}

      <Card title="Add transaction">
        {symbolOptions.length === 0 ? (
          <EmptyState message="No symbols loaded yet. Sync KMI-30 & KSE-100 from the Dashboard or Index Data page." />
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block sm:col-span-2 lg:col-span-1">
              <span className="text-sm text-slate-400">Symbol</span>
              <SymbolCombobox
                options={symbolOptions}
                value={symbol}
                onChange={handleSymbolChange}
                disabled={submitting}
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-400">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-slate-400">Quantity</span>
              <input
                required
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-400">Price per share (PKR)</span>
              <input
                required
                type="number"
                min="0"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
              <p className="mt-1 text-xs text-slate-500">Pre-filled from sync; edit to your execution price.</p>
            </label>
            <label className="block">
              <span className="text-sm text-slate-400">Fees (PKR)</span>
              <input
                type="number"
                min="0"
                step="any"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-400">Trade date</span>
              <input
                required
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="text-sm text-slate-400">Notes (optional)</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={submitting || !symbol}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Save transaction'}
              </button>
            </div>
          </form>
        )}
      </Card>

      <Card title="History">
        {transactions.length === 0 ? (
          <EmptyState message="No transactions logged yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const total = tx.quantity * tx.price_per_share + (tx.fees ?? 0)
                  return (
                    <tr key={tx.id} className="border-t border-slate-800">
                      <td className="py-2.5 text-slate-400">{tx.trade_date}</td>
                      <td className="py-2.5 font-medium">{tx.symbol}</td>
                      <td className="py-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-xs uppercase ${
                            tx.type === 'buy'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">{formatQty(tx.quantity)}</td>
                      <td className="py-2.5 text-right">{formatPkr(tx.price_per_share)}</td>
                      <td className="py-2.5 text-right">{formatPkr(total)}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => deleteTransaction(tx.id)}
                          className="text-xs text-slate-500 hover:text-rose-400"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
