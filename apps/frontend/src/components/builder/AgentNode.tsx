import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

const TYPE_COLORS: Record<string, string> = {
  research:  'bg-blue-500/20 border-blue-500/40 text-blue-400',
  writer:    'bg-purple-500/20 border-purple-500/40 text-purple-400',
  code:      'bg-green-500/20 border-green-500/40 text-green-400',
  data:      'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
  decision:  'bg-orange-500/20 border-orange-500/40 text-orange-400',
  notifier:  'bg-pink-500/20 border-pink-500/40 text-pink-400',
  custom:    'bg-gray-500/20 border-gray-500/40 text-gray-400',
}

const TYPE_ICONS: Record<string, string> = {
  research: '🔍', writer: '✍️', code: '💻',
  data: '📊', decision: '🔀', notifier: '🔔', custom: '⚙️',
}

function AgentNode({ data, selected }: NodeProps) {
  const colors = TYPE_COLORS[data.type] ?? TYPE_COLORS.custom
  const icon   = TYPE_ICONS[data.type]  ?? '⚙️'

  return (
    <div
      className={`
        min-w-[160px] max-w-[220px] rounded-xl border-2 bg-[#1a1d27]
        shadow-lg transition-all duration-150
        ${selected ? 'border-brand-500 shadow-brand-500/20' : 'border-[#2e3347]'}
      `}
    >
      {/* Target handle (input) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-[#2e3347] !bg-[#0f1117]"
      />

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl border-b border-[#2e3347] ${colors}`}>
        <span className="text-base leading-none">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider">{data.type}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-[#e8eaf0] truncate">{data.label || 'Untitled'}</p>
        {data.config?.model && (
          <p className="text-xs text-[#8891a8] mt-0.5 truncate">{data.config.model}</p>
        )}
        {data.config?.tools?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {data.config.tools.slice(0, 3).map((t: string) => (
              <span key={t} className="text-[10px] bg-[#21263a] text-[#8891a8] px-1.5 py-0.5 rounded-full">
                {t}
              </span>
            ))}
            {data.config.tools.length > 3 && (
              <span className="text-[10px] text-[#8891a8]">+{data.config.tools.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Source handle (output) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-[#2e3347] !bg-[#0f1117]"
      />
    </div>
  )
}

export default memo(AgentNode)
