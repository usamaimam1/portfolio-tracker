export interface ParsedRow {
  symbol: string
  name: string
  weight_pct: number
  price: number
  prev_close: number | null
  volume: number | null
  market_cap_m: number | null
}

export function normalizeSymbol(symbol: string): string {
  return symbol.replace(/XD$/i, '').trim().toUpperCase()
}

/** PSX WAF blocks datacenter bots — mimic a real browser request. */
export const PSX_FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://dps.psx.com.pk/',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function attrDataOrder(attrs: string): string | null {
  return attrs.match(/data-order="([^"]+)"/)?.[1] ?? null
}

export function parsePsxIndexHtml(html: string): ParsedRow[] {
  const tbody = html.match(/<tbody class="tbl__body">([\s\S]*?)<\/tbody>/)
  if (!tbody) return []

  const rows: ParsedRow[] = []
  const trMatches = tbody[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)

  for (const tr of trMatches) {
    const rowHtml = tr[1]
    if (!rowHtml.includes('tbl__symbol')) continue

    const cells = [...rowHtml.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)]
    if (cells.length < 11) continue

    const symbol =
      cells[0][2].match(/<strong>([^<]+)<\/strong>/)?.[1]?.trim() ||
      attrDataOrder(cells[0][1]) ||
      ''

    const name = stripHtml(cells[1][2])
    const prevCloseRaw = attrDataOrder(cells[2][1])
    const priceRaw = attrDataOrder(cells[3][1])
    const weightRaw = stripHtml(cells[6][2]).replace('%', '')
    const volumeRaw = attrDataOrder(cells[8][1])
    const marketCapRaw = attrDataOrder(cells[10][1])

    if (!symbol || !weightRaw) continue

    const weight_pct = parseFloat(weightRaw)
    const price = priceRaw ? parseFloat(priceRaw) : NaN
    if (!Number.isFinite(weight_pct) || !Number.isFinite(price)) continue

    rows.push({
      symbol: normalizeSymbol(symbol),
      name,
      weight_pct,
      price,
      prev_close: prevCloseRaw ? parseFloat(prevCloseRaw) : null,
      volume: volumeRaw ? parseInt(volumeRaw, 10) : null,
      market_cap_m: marketCapRaw ? parseFloat(marketCapRaw) / 1_000_000 : null,
    })
  }

  return rows
}

export async function fetchIndexRows(url: string): Promise<ParsedRow[]> {
  const res = await fetch(url, { headers: PSX_FETCH_HEADERS })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }
  const html = await res.text()
  const rows = parsePsxIndexHtml(html)
  if (rows.length === 0) throw new Error(`No constituents parsed from ${url}`)
  return rows
}
