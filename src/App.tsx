import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PortfolioProvider, usePortfolioContext } from './context/PortfolioContext'
import { ComparePage } from './pages/ComparePage'
import { DashboardPage } from './pages/DashboardPage'
import { IndexesPage } from './pages/IndexesPage'
import { LoginPage } from './pages/LoginPage'
import { PlannerPage } from './pages/PlannerPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { SettingsPage } from './pages/SettingsPage'
import { ReportsPage } from './pages/ReportsPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { LoadingState } from './components/ui'

function ProtectedRoutes() {
  const { user, authLoading } = usePortfolioContext()

  if (authLoading) return <LoadingState />

  if (!user) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="planner" element={<PlannerPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="indexes" element={<IndexesPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <PortfolioProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </PortfolioProvider>
    </BrowserRouter>
  )
}
