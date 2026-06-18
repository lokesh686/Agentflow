import { useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useExecutionStore, ExecutionStep } from '../../store/executionStore'
import { StatusBadge, Spinner, ErrorBanner } from '../../components/ui'

function formatDuration(ms: number | null) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

const STEP_ICONS: Record<string, string> = {
  agent_start: '▶',
  agent_complete: '✓',
  agent_failed: '✗',
  tool_call: '⚙',
  human_approval: '👤',
}

const STEP_COLORS: Record<string, string> = {
  agent_start:    'text-blue-400 border-blue-400/20 bg-blue-400/5',
  agent_complete: 'text-green-400 border-green-400/20 bg-green-400/5',
  agent_failed:   'text-red-400 border-red-400/20 bg-red-400/5',
  tool_call:      'text-yellow-400 border-yellow-400/20 bg-yellow-400/5',
  human_approval: 'text-purple-400 border-purple-400/20 bg-purple-400/5',
}

function StepCard({ step, index }: { step: ExecutionStep; index: number }) {
  const color = STEP_COLORS[step.type] ?? 'text-[#8891a8] border-[#2e3347] bg-[#21263a]'
  const icon  = STEP_ICONS[step.type] ?? '·'

  return (
    <div className={`border rounded-lg p-4 ${color}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-mono leading-none">{icon}</span>
          <span className="font-semibold text-sm">{step.agentName}</span>
          <span className="badge bg-black/20 text-current text-xs">{step.type}</span>
        </div>
        <div className="flex items-center gap-2 text-xs opacity-70 flex-shrink-0">
          {step.latencyMs && <span>{step.latencyMs}ms</span>}
          {step.tokensUsed?.total ? <span>{step.tokensUsed.total} tok</span> : null}
        </div>
      </div>

      {step.output && (
        <div className="mt-2 text-xs bg-black/20 rounded p-2.5 font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
          {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
        </div>
      )}
      {step.error && (
        <p className="text-xs text-red-300 mt-2 font-mono">{step.error}</p>
      )}
    </div>
  )
}

import ApprovalStep from '../../components/ApprovalStep';

export default function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { current, isLoading, fetchOne, subscribe, cancel } = useExecutionStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    fetchOne(id)
    const unsub = subscribe(id)
    return unsub
  }, [id])

  // Auto-scroll step log as new steps arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [current?.steps.length])

  if (isLoading && !current) return (
    <div className="flex justify-center items-center py-32"><Spinner size="lg" /></div>
  )
  if (!current) return (
    <div className="p-8 text-center">
      <p className="text-[#8891a8]">Execution not found.</p>
      <Link to="/executions" className="btn-secondary inline-block mt-4">← Back</Link>
    </div>
  )

  const isLive = ['QUEUED', 'RUNNING'].includes(current.status)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/executions" className="text-[#8891a8] hover:text-[#e8eaf0] text-sm">
              ← Executions
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-[#e8eaf0]">Execution Detail</h1>
          <p className="text-xs text-[#8891a8] mt-1 font-mono">{current._id}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={current.status} />
          {isLive && (
            <button onClick={() => cancel(current._id)} className="btn-ghost text-xs text-red-400 hover:bg-red-500/10">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Duration', value: formatDuration(current.durationMs) },
          { label: 'Steps', value: current.steps.length },
          { label: 'Tokens', value: current.totalTokens?.total ?? 0 },
          { label: 'Est. Cost', value: current.estimatedCostUsd ? `$${current.estimatedCostUsd.toFixed(4)}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card px-4 py-3">
            <p className="text-xs text-[#8891a8] mb-1">{label}</p>
            <p className="text-sm font-semibold text-[#e8eaf0] font-mono">{value}</p>
          </div>
        ))}
      </div>

      {/* Task input */}
      <div className="card p-4 mb-4">
        <p className="text-xs text-[#8891a8] mb-2 uppercase tracking-wider">Input</p>
        <p className="text-sm text-[#e8eaf0]">
          {typeof current.input === 'object'
            ? current.input.task || current.input.prompt || JSON.stringify(current.input)
            : String(current.input)}
        </p>
      </div>

      {/* Human approval banner */}
      {current.status === 'WAITING_FOR_APPROVAL' && <ApprovalStep execution={current} />}

      {/* Final output */}
      {current.finalOutput && (
        <div className="card p-4 mb-4 border-green-500/20 bg-green-500/5">
          <p className="text-xs text-green-400 mb-2 uppercase tracking-wider">Final Output</p>
          <p className="text-sm text-[#e8eaf0] whitespace-pre-wrap leading-relaxed">
            {current.finalOutput}
          </p>
        </div>
      )}

      {/* Error */}
      {current.error && <div className="mb-4"><ErrorBanner message={current.error} /></div>}

      {/* Step log */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3347]">
          <h2 className="font-semibold text-[#e8eaf0]">Step Log</h2>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1.5 text-xs text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Live
              </span>
            )}
            <span className="text-xs text-[#8891a8]">{current.steps.length} steps</span>
          </div>
        </div>

        <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
          {current.steps.length === 0 ? (
            <div className="text-center py-8 text-[#8891a8] text-sm">
              {isLive ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  <span>Waiting for agents to start…</span>
                </div>
              ) : 'No steps recorded.'}
            </div>
          ) : (
            current.steps.map((step, i) => <StepCard key={i} step={step} index={i} />)
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
