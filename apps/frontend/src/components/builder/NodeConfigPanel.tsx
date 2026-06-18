import { useState, useEffect } from 'react'

import PromptEditor from '../PromptEditor/PromptEditor'

const MODELS = ['gpt-4o', 'gpt-4o-mini', 'gemini-1.5-pro', 'claude-sonnet-4-6']
const TOOLS  = ['web_search', 'url_scraper', 'code_executor', 'data_analyzer', 'get_current_datetime']

interface NodeConfig {
  id: string
  type: string
  label: string
  config: {
    systemPrompt?: string
    abTestConfig?: {
      variantA: number;
      variantB: number;
      splitPercent: number;
    }
    model?: string
    temperature?: number
    tools?: string[]
    maxTokens?: number
  }
}

interface Props {
  node: NodeConfig | null
  onChange: (id: string, updates: Partial<NodeConfig>) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function NodeConfigPanel({ node, onChange, onDelete, onClose }: Props) {
  const [local, setLocal] = useState<NodeConfig | null>(null)

  useEffect(() => { setLocal(node ? JSON.parse(JSON.stringify(node)) : null) }, [node?.id])

  if (!local) return (
    <div className="w-72 border-l border-[#2e3347] bg-[#1a1d27] flex items-center justify-center p-8">
      <p className="text-sm text-[#8891a8] text-center">
        Select an agent node to configure it
      </p>
    </div>
  )

  const update = (key: string, value: any) => {
    const updated = { ...local, config: { ...local.config, [key]: value } }
    setLocal(updated)
    onChange(local.id, updated)
  }

  const toggleTool = (tool: string) => {
    const tools = local.config.tools ?? []
    const next = tools.includes(tool) ? tools.filter((t) => t !== tool) : [...tools, tool]
    update('tools', next)
  }

  return (
    <div className="w-72 border-l border-[#2e3347] bg-[#1a1d27] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e3347]">
        <h3 className="font-semibold text-[#e8eaf0] text-sm">Configure Agent</h3>
        <button onClick={onClose}
          className="text-[#8891a8] hover:text-[#e8eaf0] text-lg leading-none transition-colors">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Label */}
        <div>
          <label className="block text-xs font-medium text-[#8891a8] mb-1.5">Agent Name</label>
          <input
            className="input text-sm"
            value={local.label}
            onChange={(e) => {
              const updated = { ...local, label: e.target.value }
              setLocal(updated)
              onChange(local.id, updated)
            }}
            placeholder="e.g. Research Agent"
          />
        </div>

        {/* Type badge */}
        <div>
          <label className="block text-xs font-medium text-[#8891a8] mb-1.5">Type</label>
          <span className="badge bg-brand-500/10 text-brand-500">{local.type}</span>
        </div>

        {/* Model */}
        <div>
          <label className="block text-xs font-medium text-[#8891a8] mb-1.5">Model</label>
          <select
            className="input text-sm"
            value={local.config.model ?? 'gpt-4o'}
            onChange={(e) => update('model', e.target.value)}
          >
            {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-xs font-medium text-[#8891a8] mb-1.5">
            Temperature <span className="text-brand-500 font-mono">{local.config.temperature ?? 0.7}</span>
          </label>
          <input
            type="range" min="0" max="2" step="0.1"
            className="w-full accent-brand-500"
            value={local.config.temperature ?? 0.7}
            onChange={(e) => update('temperature', parseFloat(e.target.value))}
          />
          <div className="flex justify-between text-[10px] text-[#8891a8] mt-0.5">
            <span>Precise</span><span>Creative</span>
          </div>
        </div>

        {/* System Prompt & A/B Testing Editor */}
        <div className="-mx-2">
          <PromptEditor
            nodeId={local.id}
            initialContent={local.config.systemPrompt ?? ''}
            onChange={(newContent) => update('systemPrompt', newContent)}
            abTestConfig={local.config.abTestConfig}
            onAbTestChange={(newConfig) => update('abTestConfig', newConfig)}
          />
        </div>

        {/* Tools */}
        <div>
          <label className="block text-xs font-medium text-[#8891a8] mb-2">Tools</label>
          <div className="space-y-1.5">
            {TOOLS.map((tool) => {
              const active = (local.config.tools ?? []).includes(tool)
              return (
                <label key={tool}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer border transition-colors
                    ${active
                      ? 'border-brand-500/40 bg-brand-500/10 text-brand-500'
                      : 'border-[#2e3347] bg-[#21263a] text-[#8891a8] hover:text-[#e8eaf0]'
                    }`}
                >
                  <input type="checkbox" checked={active} onChange={() => toggleTool(tool)}
                    className="accent-brand-500" />
                  <span className="text-xs font-mono">{tool}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Max tokens */}
        <div>
          <label className="block text-xs font-medium text-[#8891a8] mb-1.5">Max Tokens</label>
          <input
            type="number" min="256" max="32000" step="256"
            className="input text-sm"
            value={local.config.maxTokens ?? 2048}
            onChange={(e) => update('maxTokens', parseInt(e.target.value))}
          />
        </div>
      </div>

      {/* Delete */}
      <div className="p-4 border-t border-[#2e3347]">
        <button
          onClick={() => onDelete(local.id)}
          className="w-full btn-ghost text-red-400 hover:bg-red-500/10 text-sm"
        >
          Delete node
        </button>
      </div>
    </div>
  )
}
