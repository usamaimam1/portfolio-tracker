export function normalizeSymbol(symbol: string): string {
  return symbol.replace(/XD$/i, '').trim().toUpperCase()
}
