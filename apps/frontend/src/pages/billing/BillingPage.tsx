import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'
import { PageHeader, Spinner, StatusBadge } from '../../components/ui'

const PLANS = [
  {
    key: 'free', name: 'Free', price: '$0', period: 'forever',
    features: ['2 workflows', '50 executions/mo', '1 team member', 'Community support'],
    cta: null,
  },
  {
    key: 'pro', name: 'Pro', price: '$49', period: '/month',
    features: ['20 workflows', '2,000 executions/mo', '5 team members', 'Priority support', 'Version history'],
    cta: 'Upgrade to Pro',
    highlight: true,
  },
  {
    key: 'enterprise', name: 'Enterprise', price: '$199', period: '/month',
    features: ['Unlimited workflows', 'Unlimited executions', 'Unlimited members', 'SLA + dedicated support', 'SSO + audit logs'],
    cta: 'Upgrade to Enterprise',
  },
]

interface BillingData {
  plan: string
  subscriptionStatus: string
  hasSubscription: boolean
  invoices: Array<{ id: string; amount: number; currency: string; status: string; date: string; pdf: string }>
  limits: { workflows: number; executionsPerMonth: number; members: number }
}

export default function BillingPage() {
  const { user } = useAuthStore()
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)

  useEffect(() => {
    api.get('/billing')
      .then((r) => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleUpgrade = async (plan: string) => {
    setUpgrading(plan)
    try {
      const { data: res } = await api.post('/billing/checkout', { plan })
      window.location.href = res.data.url
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to start checkout')
      setUpgrading(null)
    }
  }

  const handlePortal = async () => {
    setManaging(true)
    try {
      const { data: res } = await api.post('/billing/portal')
      window.location.href = res.data.url
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to open portal')
      setManaging(false)
    }
  }

  const currentPlan = data?.plan ?? 'free'

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Billing"
        subtitle="Manage your plan and payment details"
        action={data?.hasSubscription ? (
          <button onClick={handlePortal} disabled={managing}
            className="btn-secondary flex items-center gap-2">
            {managing && <Spinner size="sm" />}
            Manage subscription
          </button>
        ) : undefined}
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Current plan banner */}
          <div className="card p-5 mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#8891a8] mb-1">Current plan</p>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-[#e8eaf0] capitalize">{currentPlan}</span>
                {data?.subscriptionStatus && data.subscriptionStatus !== 'active' && (
                  <StatusBadge status={data.subscriptionStatus.toUpperCase()} />
                )}
              </div>
              {data?.limits && (
                <p className="text-xs text-[#8891a8] mt-1">
                  {data.limits.workflows === Infinity ? 'Unlimited' : data.limits.workflows} workflows ·{' '}
                  {data.limits.executionsPerMonth === Infinity ? 'Unlimited' : data.limits.executionsPerMonth} executions/mo ·{' '}
                  {data.limits.members === Infinity ? 'Unlimited' : data.limits.members} members
                </p>
              )}
            </div>
            <div className="text-3xl opacity-30">
              {currentPlan === 'free' ? '🆓' : currentPlan === 'pro' ? '⚡' : '🏢'}
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.key
              return (
                <div key={plan.key}
                  className={`card p-5 flex flex-col gap-4 transition-colors
                    ${plan.highlight ? 'border-brand-500/40' : ''}
                    ${isCurrent ? 'opacity-80' : ''}`}>
                  {plan.highlight && (
                    <div className="-mt-5 -mx-5 bg-brand-500/10 px-5 py-1.5 rounded-t-xl
                                    border-b border-brand-500/20 text-center">
                      <span className="text-xs font-medium text-brand-500">Most popular</span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-[#e8eaf0] text-lg">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-[#e8eaf0]">{plan.price}</span>
                      <span className="text-[#8891a8] text-sm">{plan.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-2 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[#8891a8]">
                        <span className="text-green-400 text-xs">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <div className="btn-secondary text-sm text-center cursor-default opacity-60">
                      Current plan
                    </div>
                  ) : plan.cta ? (
                    <button
                      onClick={() => handleUpgrade(plan.key)}
                      disabled={!!upgrading}
                      className={`flex items-center justify-center gap-2 text-sm
                        ${plan.highlight ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {upgrading === plan.key && <Spinner size="sm" />}
                      {upgrading === plan.key ? 'Redirecting…' : plan.cta}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>

          {/* Invoice history */}
          {data?.invoices && data.invoices.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-[#2e3347]">
                <h2 className="font-semibold text-[#e8eaf0]">Invoice History</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2e3347]">
                    {['Date', 'Amount', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-[#8891a8] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2e3347]">
                  {data.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#21263a] transition-colors">
                      <td className="px-4 py-3 text-[#8891a8]">{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[#e8eaf0] font-mono">
                        ${inv.amount.toFixed(2)} {inv.currency.toUpperCase()}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status.toUpperCase()} /></td>
                      <td className="px-4 py-3">
                        {inv.pdf && (
                          <a href={inv.pdf} target="_blank" rel="noreferrer"
                            className="text-brand-500 hover:text-brand-400 text-xs">
                            Download PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
