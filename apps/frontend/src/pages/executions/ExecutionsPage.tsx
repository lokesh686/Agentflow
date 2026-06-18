import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useExecutionStore } from '../../store/executionStore'
import { PageHeader, StatusBadge, EmptyState, Spinner } from '../../components/ui'

function formatDuration(ms: number | null) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

export default function ExecutionsPage() {
  const { executions, isLoading, fetch } = useExecutionStore()

  useEffect(() => { fetch() }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Executions"
        subtitle="Monitor all agent execution runs"
        action={
          <button onClick={() => fetch()} className="btn-secondary text-sm">
            ↻ Refresh
          </button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : executions.length === 0 ? (
        <EmptyState
          icon="▷"
          title="No executions yet"
          description="Run a workflow to see execution history here."
          action={<Link to="/workflows" className="btn-primary">Browse workflows</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2e3347]">
                {['Input', 'Status', 'Steps', 'Duration', 'Cost', 'Started'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#8891a8] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2e3347]">
              {executions.map((exec) => (
                <tr key={exec._id} className="hover:bg-[#21263a] transition-colors">
                  <td className="px-4 py-3 max-w-xs">
                    <Link to={`/executions/${exec._id}`} className="text-[#e8eaf0] hover:text-brand-500 transition-colors truncate block">
                      {typeof exec.input === 'object'
                        ? exec.input.task || exec.input.prompt || exec._id
                        : String(exec.input)}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={exec.status} /></td>
                  <td className="px-4 py-3 text-[#8891a8]">{exec.steps?.length ?? 0}</td>
                  <td className="px-4 py-3 text-[#8891a8] font-mono text-xs">{formatDuration(exec.durationMs)}</td>
                  <td className="px-4 py-3 text-[#8891a8] font-mono text-xs">
                    {exec.estimatedCostUsd ? `$${exec.estimatedCostUsd.toFixed(4)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#8891a8] text-xs">
                    {exec.createdAt ? new Date(exec.createdAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
