import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ErrorBanner, LoadingState } from '../components/ui'
import { usePortfolioContext } from '../context/PortfolioContext'

export function LoginPage() {
  const { user, authLoading, signIn, signUp } = usePortfolioContext()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (authLoading) return <LoadingState />

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)

    const { error: authError } =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password)

    if (authError) {
      setError(authError.message)
    } else if (mode === 'signup') {
      setMessage('Check your email to confirm your account, then sign in.')
    } else {
      navigate('/', { replace: true })
    }
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="text-xs uppercase tracking-widest text-emerald-400">PSX Portfolio</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Track your PSX holdings against KMI-30 and KSE-100.
        </p>

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        )}
        {message && (
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-400">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-emerald-400 hover:underline"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
