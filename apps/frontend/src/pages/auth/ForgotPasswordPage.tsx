import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { Spinner, ErrorBanner } from '../../components/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (sent) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117] px-4">
      <div className="card p-8 w-full max-w-sm text-center">
        <div className="text-5xl mb-4">📬</div>
        <h2 className="text-xl font-semibold text-[#e8eaf0] mb-2">Check your inbox</h2>
        <p className="text-[#8891a8] text-sm">If that email exists, a reset link is on its way.</p>
        <Link to="/login" className="btn-primary inline-block mt-6">Back to sign in</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#e8eaf0]">Reset password</h1>
          <p className="text-[#8891a8] text-sm mt-1">We'll send a reset link to your email</p>
        </div>
        <div className="card p-6">
          {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#8891a8] mb-1.5">Email</label>
              <input className="input" type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Spinner size="sm" />}
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-[#8891a8] mt-4">
          <Link to="/login" className="text-brand-500 hover:text-brand-400">← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
