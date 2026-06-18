import { useEffect, useState, FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useWorkflowStore } from '../../store/workflowStore'
import { PageHeader, StatusBadge, Spinner, Modal, ErrorBanner } from '../../components/ui'

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { current, fetchOne, update, execute, isLoading, error } = useWorkflowStore()

  const [showRun, setShowRun] = useState(false)
  const [taskInput, setTaskInput] = useState('')
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')

  useEffect(() => { if (id) fetchOne(id) }, [id])

  const handleStatusChange = async (status: string) => {
    if (!current) return
    await update(current._id, { status: status as any })
  }

  const handleRun = async (e: FormEvent) => {
    e.preventDefault()
    if (!current) return
    setRunning(true); setRunError('')
    try {
      const { executionId } = await execute(current._id, { task: taskInput })
      navigate(`/executions/${executionId}`)
    } catch (err: any) {
      setRunError(err.response?.data?.error || 'Failed to start execution')
      setRunning(false)
    }
  }

  if (isLoading) return (
    <div className="flex justify-center items-center h-full py-32"><Spinner size="lg" /></div>
  )
  if (!current) return (
    <div className="p-8 text-center">
      <p className="text-[#8891a8]">Workflow not found.</p>
      <Link to="/workflows" className="btn-secondary inline-block mt-4">← Back</Link>
    </div>
  )

  const { nodes = [], edges = [] } = current.graph

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        title={current.name}
        subtitle={current.description || 'No description'}
        action={
          <div className="flex gap-2">
            <button onClick={() => navigate(`/workflows/${current._id}/builder`)}
              className="btn-secondary text-sm">◈ Builder</button>
            <button onClick={() => navigate(`/workflows/${current._id}/webhook`)}
              className="btn-secondary text-sm">🔗 Webhook</button>
            <select
              value={current.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="input text-sm w-36"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <button
              onClick={() => setShowRun(true)}
              disabled={current.status === 'archived'}
              className="btn-primary"
            >
              ▷ Run
            </button>
          </div>
        }
      />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {/* Meta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Status', value: <StatusBadge status={current.status} /> },
          { label: 'Version', value: `v${current.version}` },
          { label: 'Total Runs', value: current.stats.totalExecutions },
          { label: 'Last Run', value: current.stats.lastExecutedAt
              ? new Date(current.stats.lastExecutedAt).toLocaleDateString() : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card px-4 py-3">
            <p className="text-xs text-[#8891a8] mb-1">{label}</p>
            <div className="text-sm font-medium text-[#e8eaf0]">{value}</div>
          </div>
        ))}
      </div>

      {/* Graph overview */}
      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-[#2e3347]">
          <h2 className="font-semibold text-[#e8eaf0]">Agent Graph</h2>
          <p className="text-xs text-[#8891a8] mt-0.5">{nodes.length} agents · {edges.length} connections</p>
        </div>
        {nodes.length === 0 ? (
          <div className="text-center py-10 text-[#8891a8] text-sm">
            No agents configured yet. Use the workflow builder to add agents.
          </div>
        ) : (
          <div className="p-5 flex flex-wrap gap-3">
            {nodes.map((node: any) => (
              <div key={node.id} className="bg-[#21263a] border border-[#2e3347] rounded-lg px-4 py-3 min-w-[160px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-[#e8eaf0] truncate">{node.label || node.id}</span>
                </div>
                <span className="badge bg-[#2e3347] text-[#8891a8] text-xs">{node.type}</span>
                {node.config?.tools?.length > 0 && (
                  <p className="text-xs text-[#8891a8] mt-1">{node.config.tools.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      {current.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {current.tags.map((t) => (
            <span key={t} className="badge bg-brand-500/10 text-brand-500">{t}</span>
          ))}
        </div>
      )}

      {/* Run modal */}
      <Modal open={showRun} onClose={() => setShowRun(false)} title={`Run "${current.name}"`}>
        {runError && <div className="mb-4"><ErrorBanner message={runError} /></div>}
        <form onSubmit={handleRun} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#8891a8] mb-1.5">Task / Prompt</label>
            <textarea
              className="input resize-none h-28"
              placeholder="Describe what you want the agents to do…"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowRun(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={running} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {running && <Spinner size="sm" />}
              {running ? 'Starting…' : '▷ Run workflow'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
