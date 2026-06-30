import type { TransactionType } from '../types'
import { normalizeSymbol, userTransactionFees } from './portfolio'

export interface CsvImportRow {
  symbol: string
  market: string
  houseAccount: string | null
  quantity: number
  rate: number
  commissionAmount: number
  cvtWht: number
  secpLaga: number
  psxLaga: number
  salesTax: number
  nccpl: number
  advanceTax: number
  cdcCharges: number
  amount: number
  tradeDate: string
  rowNumber: number
}

export interface CsvParseResult {
  rows: CsvImportRow[]
  errors: { row: number; message: string }[]
}

export interface CsvImportPayload {
  symbol: string
  type: TransactionType
  quantity: number
  price_per_share: number
  fees: number
  trade_date: string
  market: string
  house_account: string | null
  commission_amount: number
  cvt_wht: number
  secp_laga: number
  psx_laga: number
  sales_tax: number
  nccpl: number
  advance_tax: number
  cdc_charges: number
  gross_amount: number
  source: 'csv'
  row_fingerprint: string
}

const HEADER_ALIASES: Record<string, string> = {
  scrip: 'symbol',
  symbol: 'symbol',
  market: 'market',
  'house a/c': 'house_account',
  'house ac': 'house_account',
  house_account: 'house_account',
  quantity: 'quantity',
  qty: 'quantity',
  rate: 'rate',
  price: 'rate',
  'comm. amount': 'commission',
  'comm amount': 'commission',
  commission: 'commission',
  'cvt / wht': 'cvt_wht',
  'cvt/wht': 'cvt_wht',
  cvt_wht: 'cvt_wht',
  'secp laga': 'secp_laga',
  secp_laga: 'secp_laga',
  'psx laga': 'psx_laga',
  psx_laga: 'psx_laga',
  'sales tax': 'sales_tax',
  sales_tax: 'sales_tax',
  nccpl: 'nccpl',
  'advance tax': 'advance_tax',
  advance_tax: 'advance_tax',
  'cdc charges': 'cdc_charges',
  cdc_charges: 'cdc_charges',
  amount: 'amount',
  date: 'trade_date',
  'trade date': 'trade_date',
  trade_date: 'trade_date',
}

function normalizeHeader(h: string): string {
  const key = h.trim().toLowerCase().replace(/\s+/g, ' ')
  return HEADER_ALIASES[key] ?? key
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

function parseNumber(raw: string): number {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.-]/g, '').trim()
  if (!cleaned) return 0
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const month = dmy[2].padStart(2, '0')
    let year = dmy[3]
    if (year.length === 2) year = `20${year}`
    return `${year}-${month}-${day}`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return null
}

export function parseBrokerCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const errors: { row: number; message: string }[] = []
  const rows: CsvImportRow[] = []

  if (lines.length < 2) {
    return { rows, errors: [{ row: 0, message: 'CSV is empty or has no data rows.' }] }
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const col = (name: string) => headers.indexOf(name)

  const required = ['symbol', 'quantity', 'rate', 'amount']
  for (const req of required) {
    if (col(req) < 0) {
      errors.push({ row: 1, message: `Missing required column: ${req}` })
    }
  }
  if (errors.length > 0) return { rows, errors }

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const rowNumber = i + 1
    const get = (name: string) => {
      const idx = col(name)
      return idx >= 0 ? (cells[idx] ?? '').trim() : ''
    }

    const symbol = normalizeSymbol(get('symbol'))
    if (!symbol) {
      errors.push({ row: rowNumber, message: 'Missing symbol' })
      continue
    }

    const market = get('market') || 'Ready'
    if (market.toLowerCase() !== 'ready') {
      errors.push({ row: rowNumber, message: `Skipped — Market must be Ready (got "${market}")` })
      continue
    }

    const quantity = parseNumber(get('quantity'))
    const rate = parseNumber(get('rate'))
    const amount = parseNumber(get('amount'))

    if (quantity <= 0 || rate <= 0) {
      errors.push({ row: rowNumber, message: 'Invalid quantity or rate' })
      continue
    }

    const tradeDate =
      parseDate(get('trade_date')) ?? new Date().toISOString().slice(0, 10)

    rows.push({
      symbol,
      market,
      houseAccount: get('house_account') || null,
      quantity,
      rate,
      commissionAmount: parseNumber(get('commission')),
      cvtWht: parseNumber(get('cvt_wht')),
      secpLaga: parseNumber(get('secp_laga')),
      psxLaga: parseNumber(get('psx_laga')),
      salesTax: parseNumber(get('sales_tax')),
      nccpl: parseNumber(get('nccpl')),
      advanceTax: parseNumber(get('advance_tax')),
      cdcCharges: parseNumber(get('cdc_charges')),
      amount,
      tradeDate,
      rowNumber,
    })
  }

  return { rows, errors }
}

export function rowFingerprint(
  type: TransactionType,
  row: CsvImportRow,
): string {
  return [
    type,
    row.symbol,
    row.tradeDate,
    row.quantity,
    row.rate,
    row.amount,
    row.market,
  ].join('|')
}

export function toImportPayload(
  type: TransactionType,
  row: CsvImportRow,
): CsvImportPayload {
  const fees = row.cvtWht + row.salesTax + row.cdcCharges + row.advanceTax

  return {
    symbol: row.symbol,
    type,
    quantity: row.quantity,
    price_per_share: row.rate,
    fees,
    trade_date: row.tradeDate,
    market: row.market,
    house_account: row.houseAccount,
    commission_amount: row.commissionAmount,
    cvt_wht: row.cvtWht,
    secp_laga: row.secpLaga,
    psx_laga: row.psxLaga,
    sales_tax: row.salesTax,
    nccpl: row.nccpl,
    advance_tax: row.advanceTax,
    cdc_charges: row.cdcCharges,
    gross_amount: row.amount,
    source: 'csv',
    row_fingerprint: rowFingerprint(type, row),
  }
}

export async function hashFileContent(text: string): Promise<string> {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  const data = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function summarizeUserFees(tx: Pick<CsvImportPayload, 'cvt_wht' | 'sales_tax' | 'cdc_charges' | 'advance_tax'>): number {
  return userTransactionFees({
    fees: 0,
    cvt_wht: tx.cvt_wht,
    sales_tax: tx.sales_tax,
    cdc_charges: tx.cdc_charges,
    advance_tax: tx.advance_tax,
  } as Parameters<typeof userTransactionFees>[0])
}
