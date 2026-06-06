import { Spinner } from '../ui'

const NODE_TYPES = [
  { type: 'research',  icon: '🔍', label: 'Research' },
  { type: 'writer',    icon: '✍️',  label: 'Writer'   },
  { type: 'code',      icon: '💻', label: 'Code'     },
  { type: 'data',      icon: '📊', label: 'Data'     },
  { type: 'decision',  icon: '🔀', label: 'Decision' },
  { type: 'notifier',  icon: '🔔', label: 'Notifier' },
  { type: 'custom',    icon: '⚙️',  label: 'Custom'   },
]

interface Props {
  onAddNode: (type: string) => void
  onSave: () => void
  onRun: () => void
  onValidate: () => void
  saving: boolean
  errors: string[]
  nodeCount: number
}

export default function BuilderToolbar({ onAddNode, onSave, onRun, onValidate, saving, errors, nodeCount }: Props) {
  return (
    <div className="flex flex-col gap-0 border-b border-[#2e3347] bg-[#1a1d27]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8891a8]">Add agent:</span>
          <div className="flex gap-1">
            {NODE_TYPES.map(({ type, icon, label }) => (
              <button
                key={type}
                onClick={() => onAddNode(type)}
                title={label}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                           bg-[#21263a] text-[#8891a8] hover:text-[#e8eaf0] hover:bg-[#2a2f47]
                           border border-[#2e3347] transition-colors"
              >
                <span>{icon}</span>
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8891a8]">{nodeCount} node{nodeCount !== 1 ? 's' : ''}</span>
          <button onClick={onValidate} className="btn-ghost text-xs py-1.5 px-3">Validate</button>
          <button onClick={onSave} disabled={saving}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
            {saving && <Spinner size="sm" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onRun} className="btn-primary text-xs py-1.5 px-3">
            ▷ Run
          </button>
        </div>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="px-4 py-2 bg-red-500/5 border-t border-red-500/20">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {errors.map((err, i) => (
              <span key={i} className="text-xs text-red-400 flex items-center gap-1">
                <span>⚠</span> {err}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
