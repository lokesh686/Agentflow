import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Spinner, ErrorBanner } from '../../components/ui'

export default function RegisterPage() {
  const { register, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      const { message } = await register(form.name, form.email, form.password)
      setSuccess(message)
    } catch { /* shown via store */ }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1117] px-4">
        <div className="w-full max-w-sm text-center card p-8">
          <div className="text-5xl mb-4">✉️</div>
          <h2 className="text-xl font-semibold text-[#e8eaf0] mb-2">Check your email</h2>
          <p className="text-[#8891a8] text-sm">{success}</p>
          <Link to="/login" className="btn-primary inline-block mt-6">Back to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-brand-500 text-3xl font-bold">AgentFlow</span>
          <span className="text-[#8891a8] text-3xl font-light">Pro</span>
          <p className="text-[#8891a8] text-sm mt-2">Create your account</p>
        </div>

        <div className="card p-6">
          {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {(['name', 'email', 'password'] as const).map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-[#8891a8] mb-1.5 capitalize">
                  {field}
                </label>
                <input
                  className="input"
                  type={field === 'email' ? 'email' : field === 'password' ? 'password' : 'text'}
                  placeholder={
                    field === 'name' ? 'Your name'
                    : field === 'email' ? 'you@example.com'
                    : '8+ characters'
                  }
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  required
                />
              </div>
            ))}
            <button type="submit" disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {isLoading && <Spinner size="sm" />}
              {isLoading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#8891a8] mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-500 hover:text-brand-400 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
