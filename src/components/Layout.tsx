import { NavLink, Outlet } from 'react-router-dom'
import { usePortfolioContext } from '../context/PortfolioContext'

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/portfolio', label: 'Holdings' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/compare', label: 'Compare' },
  { to: '/indexes', label: 'Index Data' },
]

export function Layout() {
  const { user, signOut, summary } = usePortfolioContext()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-400">PSX</p>
            <h1 className="text-lg font-semibold">Portfolio Tracker</h1>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm transition ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-slate-400 sm:block">{user?.email}</p>
            <button
              onClick={() => signOut()}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-800 px-4 py-2 md:hidden">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3 py-1.5 text-sm ${
                  isActive ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        Portfolio value: PKR {summary.totalValue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
      </footer>
    </div>
  )
}
