import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../../lib/api'
import { Spinner } from '../../components/ui'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setStatus('error'); return }
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117] px-4">
      <div className="card p-8 w-full max-w-sm text-center">
        {status === 'loading' && (
          <><div className="flex justify-center mb-4"><Spinner size="lg" /></div>
          <p className="text-[#8891a8]">Verifying your email…</p></>
        )}
        {status === 'success' && (
          <><div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-[#e8eaf0] mb-2">Email verified!</h2>
          <p className="text-[#8891a8] text-sm mb-6">Your account is now active.</p>
          <Link to="/login" className="btn-primary inline-block">Sign in</Link></>
        )}
        {status === 'error' && (
          <><div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-[#e8eaf0] mb-2">Verification failed</h2>
          <p className="text-[#8891a8] text-sm mb-6">This link may have expired.</p>
          <Link to="/login" className="btn-secondary inline-block">Back to sign in</Link></>
        )}
      </div>
    </div>
  )
}
