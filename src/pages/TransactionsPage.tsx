import { useMemo, useRef, useState } from 'react'
import { SymbolCombobox } from '../components/SymbolCombobox'
import { SortableTh } from '../components/SortableTh'
import { Card, EmptyState, ErrorBanner, LoadingState } from '../components/ui'
import { usePortfolioContext } from '../context/PortfolioContext'
import { useTableSort } from '../hooks/useTableSort'
import { parseBrokerCsv } from '../lib/csv-import'
import { formatPkr, formatQty, userTransactionFees } from '../lib/portfolio'
import type { Transaction, TransactionType } from '../types'

type TxSortKey = 'date' | 'symbol' | 'type' | 'quantity' | 'price' | 'total'

const txAccessors: Record<TxSortKey, (tx: Transaction) => string | number> = {
  date: (tx) => tx.trade_date,
  symbol: (tx) => tx.symbol,
  type: (tx) => tx.type,
  quantity: (tx) => tx.quantity,
  price: (tx) => tx.price_per_share,
  total: (tx) => tx.quantity * tx.price_per_share + userTransactionFees(tx),
}

export function TransactionsPage() {
  const { transactions, prices, loading, error, addTransaction, deleteTransaction, importCsvTransactions } =
    usePortfolioContext()
  const { sortKey, sortDir, toggle, sort } = useTableSort<TxSortKey>('date', 'desc')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<ReturnType<typeof parseBrokerCsv> | null>(null)
  const [importType, setImportType] = useState<TransactionType>('buy')
  const [pendingFile, setPendingFile] = useState<{ text: string; name: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const sortedTransactions = useMemo(
    () => sort(transactions, txAccessors),
    [transactions, sort],
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseBrokerCsv(text)
    setPendingFile({ text, name: file.name })
    setImportPreview(parsed)
    setImportMessage(null)
    e.target.value = ''
  }

  const confirmImport = async () => {
    if (!pendingFile) return
    setSubmitting(true)
    setImportMessage(null)
    const result = await importCsvTransactions(pendingFile.text, importType, pendingFile.name)
    setSubmitting(false)

    if (result.skipped) {
      setImportMessage(result.message ?? 'Report already imported.')
    } else if (result.error && result.imported === 0) {
      setFormError(result.error)
    } else {
      setImportMessage(result.message ?? `Imported ${result.imported} rows.`)
      if (result.error) setImportMessage((m) => `${m} Warnings: ${result.error}`)
      setImportPreview(null)
      setPendingFile(null)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Transactions</h2>
        <p className="text-sm text-slate-400">
          Log buys and sells manually or import broker CSV reports (idempotent — same file won&apos;t import twice).
        </p>
      </div>

      {(error || formError) && <ErrorBanner message={formError ?? error ?? ''} />}
      {importMessage && <p className="text-sm text-emerald-400">{importMessage}</p>}

      <Card title="Import broker CSV">
        <p className="mb-3 text-xs text-slate-500">
          Columns: Scrip, Market (Ready), House A/c, Quantity, Rate, Comm. Amount, CVT/WHT, Secp Laga,
          PSX Laga, Sales Tax, NCCPL, Advance Tax, CDC Charges, Amount.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-slate-400">Report type</span>
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as TransactionType)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            >
              <option value="buy">Purchases</option>
              <option value="sell">Sales</option>
            </select>
          </label>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelect} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Choose CSV
          </button>
          {pendingFile && (
            <button
              type="button"
              disabled={submitting || !importPreview?.rows.length}
              onClick={confirmImport}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? 'Importing…' : `Import ${importPreview?.rows.length ?? 0} ${importType}(s)`}
            </button>
          )}
        </div>

        {importPreview && (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-slate-400">
              {pendingFile?.name}: {importPreview.rows.length} valid row(s)
              {importPreview.errors.length > 0 && (
                <span className="text-amber-400"> · {importPreview.errors.length} skipped</span>
              )}
            </p>
            {importPreview.errors.slice(0, 5).map((err) => (
              <p key={`${err.row}-${err.message}`} className="text-xs text-amber-400">
                Row {err.row}: {err.message}
              </p>
            ))}
          </div>
        )}
      </Card>

      <Card title="Add transaction">
        {symbolOptions.length === 0 ? (
          <EmptyState message="No symbols loaded yet. Sync indexes from Index Data." />
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
                  <SortableTh label="Date" sortKey="date" activeKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortableTh label="Symbol" sortKey="symbol" activeKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortableTh label="Type" sortKey="type" activeKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortableTh label="Qty" sortKey="quantity" activeKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                  <SortableTh label="Price" sortKey="price" activeKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                  <SortableTh label="Total" sortKey="total" activeKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                  <th className="pb-2">Source</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((tx) => {
                  const total = tx.quantity * tx.price_per_share + userTransactionFees(tx)
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
                      <td className="py-2.5 text-xs text-slate-500">{tx.source ?? 'manual'}</td>
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
