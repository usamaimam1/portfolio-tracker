import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePortfolio } from '../hooks/usePortfolio'

type PortfolioContextValue = ReturnType<typeof usePortfolio> & {
  user: ReturnType<typeof useAuth>['user']
  authLoading: boolean
  signIn: ReturnType<typeof useAuth>['signIn']
  signUp: ReturnType<typeof useAuth>['signUp']
  signOut: () => Promise<{ error: unknown }>
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null)

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth()
  const portfolio = usePortfolio(user?.id)

  return (
    <PortfolioContext.Provider
      value={{ ...portfolio, user, authLoading, signIn, signUp, signOut }}
    >
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolioContext() {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error('usePortfolioContext must be used within PortfolioProvider')
  return ctx
}
