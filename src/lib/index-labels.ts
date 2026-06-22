export const INDEX_LABELS: Record<string, string> = {
  KMI30: 'KMI-30',
  KSE100: 'KSE-100',
  ALLSHR: 'KSE All Share',
  KMIALLSHR: 'KMI All Share',
}

export function indexLabel(code: string): string {
  return INDEX_LABELS[code] ?? code
}
