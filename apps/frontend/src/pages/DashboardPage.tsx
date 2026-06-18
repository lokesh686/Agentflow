import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useWorkflowStore } from '../store/workflowStore'
import { useExecutionStore } from '../store/executionStore'
import { getSocket } from '../lib/socket'
import { StatusBadge, Spinner } from '../components/ui'

interface LiveEvent {
  id: string; type: string; executionId: string; timestamp: string; payload: any
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-[#8891a8] uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? 'text-[#e8eaf0]'}`}>{value}</p>
      {sub && <p className="text-xs text-[#8891a8] mt-1">{sub}</p>}
    </div>
  )
}

function LiveEventRow({ event }: { event: LiveEvent }) {
  const COLORS: Record<string, string> = { step: 'text-blue-400', status: 'text-yellow-400', done: 'text-green-400', error: 'text-red-400', approval_required: 'text-orange-400' }
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#2e3347] last:border-0">
      <span className={`text-xs font-mono mt-0.5 flex-shrink-0 ${COLORS[event.type] ?? 'text-[#8891a8]'}`}>{event.type}</span>
      <div className="min-w-0 flex-1">
        <Link to={`/executions/${event.executionId}`} className="text-xs text-[#8891a8] font-mono truncate block hover:text-brand-500">{event.executionId}</Link>
        {event.payload?.agentName && <p className="text-xs text-[#e8eaf0] truncate">{event.payload.agentName}</p>}
        {event.payload?.status && <StatusBadge status={event.payload.status} />}
        {event.payload?.error && <p className="text-xs text-red-400 truncate">{event.payload.error}</p>}
      </div>
      <span className="text-[10px] text-[#8891a8] flex-shrink-0">{new Date(event.timestamp).toLocaleTimeString()}</span>
    </div>
  )
}

import UsageWidget from '../components/UsageWidget';

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { workflows, fetch: fetchWorkflows } = useWorkflowStore()
  const { executions, fetch: fetchExecutions, isLoading } = useExecutionStore()
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const [isLive, setIsLive] = useState(false)
  const idRef = useRef(0)

  useEffect(() => { fetchWorkflows(true); fetchExecutions() }, [])

  useEffect(() => {
    if (!user?.teamId) return
    const socket = getSocket()
    const onEvent = (ev: any) => setLiveEvents((p) => [{ id: String(idRef.current++), ...ev }, ...p].slice(0, 50))
    socket.on('connect', () => setIsLive(true))
    socket.on('disconnect', () => setIsLive(false))
    socket.on('execution:event', onEvent)
    socket.emit('join:team', user.teamId)
    setIsLive(socket.connected)
    return () => { socket.off('execution:event', onEvent); socket.emit('leave:team', user.teamId) }
  }, [user?.teamId])

  const running = executions.filter((e) => e.status === 'RUNNING').length
  const completed = executions.filter((e) => e.status === 'COMPLETED').length
  const failed = executions.filter((e) => e.status === 'FAILED').length
  const paused = executions.filter((e) => e.status === 'PAUSED').length
  const activeWf = workflows.filter((w) => w.status === 'active').length
  const totalCost = executions.reduce((s, e) => s + (e.estimatedCostUsd ?? 0), 0)
  const totalTokens = executions.reduce((s, e) => s + (e.totalTokens?.total ?? 0), 0)
  const successRate = (completed + failed) > 0 ? Math.round((completed / (completed + failed)) * 100) : null

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e8eaf0]">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-[#8891a8] text-sm mt-1">Real-time agent activity dashboard</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className={isLive ? 'text-green-400' : 'text-red-400'}>{isLive ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <MetricCard label="Active Workflows" value={activeWf} />
        <MetricCard label="Running Now" value={running} accent="text-blue-400" />
        <MetricCard label="Success Rate" value={successRate !== null ? `${successRate}%` : '—'} sub={`${completed} ok · ${failed} failed`} accent={successRate !== null ? (successRate >= 80 ? 'text-green-400' : 'text-red-400') : undefined} />
        <MetricCard label="Total Cost" value={`$${totalCost.toFixed(4)}`} sub={`${totalTokens.toLocaleString()} tokens`} />
      </div>

      <div className="mb-8">
        <UsageWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3347]">
            <h2 className="font-semibold text-[#e8eaf0]">Live Event Stream</h2>
            <div className="flex items-center gap-3">
              {liveEvents.length > 0 && <button onClick={() => setLiveEvents([])} className="text-xs text-[#8891a8] hover:text-[#e8eaf0]">Clear</button>}
              <span className="text-xs text-[#8891a8]">{liveEvents.length} events</span>
            </div>
          </div>
          <div className="overflow-y-auto max-h-80 px-5">
            {liveEvents.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-[#8891a8] text-sm gap-2">
                {isLive ? <><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Listening…</> : 'Not connected'}
              </div>
            ) : liveEvents.map((ev) => <LiveEventRow key={ev.id} event={ev} />)}
          </div>
        </div>

        <div className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3347]">
            <h2 className="font-semibold text-[#e8eaf0]">Recent Executions</h2>
            <Link to="/executions" className="text-xs text-brand-500 hover:text-brand-400">View all →</Link>
          </div>
          <div className="overflow-y-auto max-h-80">
            {isLoading ? <div className="flex justify-center py-10"><Spinner /></div>
            : executions.length === 0 ? (
              <div className="text-center py-10 text-[#8891a8] text-sm">
                No executions yet. <Link to="/workflows" className="text-brand-500">Run a workflow</Link>
              </div>
            ) : (
              <div className="divide-y divide-[#2e3347]">
                {executions.slice(0, 10).map((exec) => (
                  <Link key={exec._id} to={`/executions/${exec._id}`} className="flex items-center justify-between px-5 py-3 hover:bg-[#21263a] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#e8eaf0] truncate">{typeof exec.input === 'object' ? exec.input.task || exec.input.prompt || exec._id : String(exec.input)}</p>
                      <p className="text-xs text-[#8891a8] mt-0.5">{new Date(exec.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="ml-3 flex-shrink-0"><StatusBadge status={exec.status} /></div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { to: '/workflows', icon: '◈', label: 'Workflows', sub: `${workflows.length} total` },
          { to: '/executions', icon: '▷', label: 'Executions', sub: `${running} running` },
          { to: '/billing', icon: '💳', label: 'Billing', sub: 'Manage plan' },
          { to: '/templates', icon: '📚', label: 'Templates', sub: 'Browse library' },
        ].map(({ to, icon, label, sub }) => (
          <Link key={label} to={to} className="card p-4 hover:border-brand-500/40 transition-colors group flex items-center gap-3">
            <div className="text-xl text-[#8891a8] group-hover:text-brand-500 transition-colors">{icon}</div>
            <div>
              <p className="text-sm font-medium text-[#e8eaf0] group-hover:text-brand-500 transition-colors">{label}</p>
              <p className="text-xs text-[#8891a8]">{sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
