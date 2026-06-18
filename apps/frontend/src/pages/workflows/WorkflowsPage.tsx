import { useEffect, useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWorkflowStore } from '../../store/workflowStore'
import { PageHeader, StatusBadge, EmptyState, Spinner, Modal, ErrorBanner } from '../../components/ui'

function WorkflowCard({ workflow }: { workflow: any }) {
  const navigate = useNavigate()
  const { remove } = useWorkflowStore()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!confirm(`Delete "${workflow.name}"?`)) return
    setDeleting(true)
    try { await remove(workflow._id) } finally { setDeleting(false) }
  }

  return (
    <div className="card p-5 hover:border-[#3e4560] transition-colors flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/workflows/${workflow._id}`}
            className="font-semibold text-[#e8eaf0] hover:text-brand-500 transition-colors truncate block">
            {workflow.name}
          </Link>
          {workflow.description && (
            <p className="text-xs text-[#8891a8] mt-1 line-clamp-2">{workflow.description}</p>
          )}
        </div>
        <StatusBadge status={workflow.status} />
      </div>

      <div className="flex items-center gap-3 text-xs text-[#8891a8]">
        <span>{workflow.graph?.nodes?.length ?? 0} agents</span>
        <span>·</span>
        <span>v{workflow.version}</span>
        <span>·</span>
        <span>{workflow.stats?.totalExecutions ?? 0} runs</span>
      </div>

      {workflow.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {workflow.tags.map((t: string) => (
            <span key={t} className="badge bg-brand-500/10 text-brand-500">{t}</span>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t border-[#2e3347]">
        <button onClick={() => navigate(`/workflows/${workflow._id}`)}
          className="btn-secondary text-xs py-1.5 flex-1">Open</button>
        <button onClick={handleDelete} disabled={deleting}
          className="btn-ghost text-xs py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10">
          {deleting ? '…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

export default function WorkflowsPage() {
  const { workflows, isLoading, error, hasMore, fetch, create } = useWorkflowStore()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', tags: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => { fetch(true) }, [])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreating(true); setCreateError('')
    try {
      const wf = await create({
        name: form.name,
        description: form.description,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      })
      setShowCreate(false)
      setForm({ name: '', description: '', tags: '' })
      navigate(`/workflows/${wf._id}`)
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create workflow')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Workflows"
        subtitle="Build and manage your multi-agent pipelines"
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            + New Workflow
          </button>
        }
      />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {isLoading && workflows.length === 0 ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : workflows.length === 0 ? (
        <EmptyState
          icon="◈"
          title="No workflows yet"
          description="Create your first multi-agent workflow to get started."
          action={
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              Create workflow
            </button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((wf) => <WorkflowCard key={wf._id} workflow={wf} />)}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button onClick={() => fetch()} className="btn-secondary text-sm">
                Load more
              </button>
            </div>
          )}
        </>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Workflow">
        {createError && <div className="mb-4"><ErrorBanner message={createError} /></div>}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#8891a8] mb-1.5">Name *</label>
            <input className="input" placeholder="e.g. Research & Write Report"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8891a8] mb-1.5">Description</label>
            <textarea className="input resize-none h-20" placeholder="What does this workflow do?"
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8891a8] mb-1.5">Tags (comma-separated)</label>
            <input className="input" placeholder="research, content, automation"
              value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={creating} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {creating && <Spinner size="sm" />}
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
