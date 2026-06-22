import type { ReactNode } from 'react'

export function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="font-medium text-slate-200">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 px-4 py-8 text-center text-sm text-slate-400">
      {message}
    </div>
  )
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <span className="animate-pulse">Loading…</span>
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
      {message}
    </div>
  )
}
