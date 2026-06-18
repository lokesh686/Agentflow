import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Spinner, ErrorBanner } from '../../components/ui'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [params] = useSearchParams()
  const { login, loginWithTokens, isLoading, error } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const accessToken = params.get('accessToken')
    const refreshToken = params.get('refreshToken')
    
    if (accessToken && refreshToken) {
      loginWithTokens(accessToken, refreshToken)
      navigate('/', { replace: true })
    }
  }, [params, loginWithTokens, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
      navigate('/')
    } catch {
      // Error is handled in the store
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0f1117]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#e8eaf0]">
            <span className="text-brand-500">AgentFlow</span> Pro
          </h1>
          <p className="mt-2 text-sm text-[#8891a8]">Sign in to your account</p>
        </div>

        <div className="card p-8">
          {error && <ErrorBanner message={error} className="mb-6" />}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#8891a8] mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-[#8891a8]" htmlFor="password">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-medium text-brand-500 hover:text-brand-400">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                className="input w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="btn-primary w-full mt-2 flex justify-center py-2.5"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#2e3347]" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-[#1a1d27] px-2 text-[#8891a8]">Or continue with</span></div>
          </div>

          <a
            href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/auth/oauth/google`}
            className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-[#2e3347] rounded-lg text-sm font-medium hover:bg-[#21263a] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
            Google
          </a>
        </div>

        <p className="text-center text-sm text-[#8891a8] mt-6">
          Don't have an account? <Link to="/register" className="text-brand-500 hover:text-brand-400 font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  )
}