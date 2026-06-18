import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, applyNodeChanges, applyEdgeChanges,
  Node, Edge, Connection, NodeChange, EdgeChange,
  ReactFlowProvider, useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'

import AgentNode from '../../../components/builder/AgentNode'
import NodeConfigPanel from '../../../components/builder/NodeConfigPanel'
import BuilderToolbar from '../../../components/builder/BuilderToolbar'
import { Modal, Spinner } from '../../../components/ui'
import { useWorkflowStore } from '../../../store/workflowStore'

const NODE_TYPES = { agentNode: AgentNode }

// Convert DB node → ReactFlow node
function toRFNode(n: any): Node {
  return {
    id: n.id,
    type: 'agentNode',
    position: n.position ?? { x: Math.random() * 400, y: Math.random() * 300 },
    data: { type: n.type, label: n.label, config: n.config ?? {} },
  }
}

// Convert ReactFlow node → DB node
function fromRFNode(n: Node): any {
  return {
    id: n.id,
    type: n.data.type,
    label: n.data.label,
    position: n.position,
    config: n.data.config,
  }
}

// Convert DB edge → ReactFlow edge
function toRFEdge(e: any): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: true,
    style: { stroke: '#4f6ef7', strokeWidth: 1.5 },
    data: { condition: e.condition },
  }
}

// Convert ReactFlow edge → DB edge
function fromRFEdge(e: Edge): any {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    condition: e.data?.condition ?? { type: 'always' },
  }
}

let nodeIdCounter = 1

function BuilderInner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { current, fetchOne, update, execute } = useWorkflowStore()
  const { fitView } = useReactFlow()

  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [showRun, setShowRun] = useState(false)
  const [taskInput, setTaskInput] = useState('')
  const [running, setRunning] = useState(false)

  // Load workflow
  useEffect(() => {
    if (id) fetchOne(id)
  }, [id])

  useEffect(() => {
    if (current) {
      const rfNodes = (current.graph.nodes ?? []).map(toRFNode)
      const rfEdges = (current.graph.edges ?? []).map(toRFEdge)
      setNodes(rfNodes)
      setEdges(rfEdges)
      setTimeout(() => fitView({ padding: 0.2 }), 100)
    }
  }, [current?._id])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es))
  }, [])

  const onConnect = useCallback((conn: Connection) => {
    setEdges((es) => addEdge({
      ...conn,
      animated: true,
      style: { stroke: '#4f6ef7', strokeWidth: 1.5 },
      data: { condition: { type: 'always' } },
    }, es))
  }, [])

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode({ id: node.id, type: node.data.type, label: node.data.label, config: node.data.config })
  }, [])

  const onPaneClick = useCallback(() => setSelectedNode(null), [])

  // Add a new agent node at a random position
  const handleAddNode = (type: string) => {
    const id = `node-${Date.now()}-${nodeIdCounter++}`
    const newNode: Node = {
      id,
      type: 'agentNode',
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { type, label: `${type.charAt(0).toUpperCase() + type.slice(1)} Agent`, config: { model: 'gpt-4o', temperature: 0.7, tools: [] } },
    }
    setNodes((ns) => [...ns, newNode])
  }

  // Update node data from config panel
  const handleNodeChange = (nodeId: string, updates: any) => {
    setNodes((ns) => ns.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, label: updates.label, config: updates.config } }
        : n
    ))
    setSelectedNode(updates)
  }

  const handleNodeDelete = (nodeId: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== nodeId))
    setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
  }

  // Client-side graph validation
  const validate = (): string[] => {
    const errs: string[] = []
    if (nodes.length === 0) { errs.push('Add at least one agent node'); return errs }
    const nodeIds = new Set(nodes.map((n) => n.id))
    const connected = new Set<string>()
    for (const e of edges) {
      if (!nodeIds.has(e.source)) errs.push(`Edge references missing node: ${e.source}`)
      if (!nodeIds.has(e.target)) errs.push(`Edge references missing node: ${e.target}`)
      connected.add(e.source); connected.add(e.target)
    }
    if (nodes.length > 1) {
      for (const n of nodes) {
        if (!connected.has(n.id)) errs.push(`"${n.data.label}" is disconnected`)
      }
    }
    for (const n of nodes) {
      if (n.data.type === 'custom' && !n.data.config?.systemPrompt?.trim()) {
        errs.push(`Custom node "${n.data.label}" needs a system prompt`)
      }
    }
    return errs
  }

  const handleValidate = () => setErrors(validate())

  const handleSave = async () => {
    const errs = validate()
    setErrors(errs)
    if (errs.length > 0 || !current) return
    setSaving(true)
    try {
      await update(current._id, {
        graph: {
          nodes: nodes.map(fromRFNode),
          edges: edges.map(fromRFEdge),
        },
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRun = async () => {
    if (!current) return
    setRunning(true)
    try {
      const { executionId } = await execute(current._id, { task: taskInput })
      navigate(`/executions/${executionId}`)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to run')
      setRunning(false)
    }
  }

  if (!current) return (
    <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
  )

  return (
    <div className="flex flex-col h-screen bg-[#0f1117]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2e3347] bg-[#1a1d27]">
        <button onClick={() => navigate(`/workflows/${current._id}`)}
          className="text-[#8891a8] hover:text-[#e8eaf0] text-sm transition-colors">← Back</button>
        <span className="text-[#2e3347]">|</span>
        <h1 className="font-semibold text-[#e8eaf0] text-sm truncate">{current.name}</h1>
        <span className="badge bg-brand-500/10 text-brand-500 text-xs">Builder</span>
      </div>

      <BuilderToolbar
        onAddNode={handleAddNode}
        onSave={handleSave}
        onRun={() => setShowRun(true)}
        onValidate={handleValidate}
        saving={saving}
        errors={errors}
        nodeCount={nodes.length}
      />

      {/* Canvas + config panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            deleteKeyCode="Delete"
            style={{ background: '#0f1117' }}
          >
            <Background color="#2e3347" gap={24} size={1} />
            <Controls
              style={{ background: '#1a1d27', border: '1px solid #2e3347', borderRadius: 8 }}
            />
            <MiniMap
              style={{ background: '#1a1d27', border: '1px solid #2e3347', borderRadius: 8 }}
              nodeColor="#4f6ef7"
              maskColor="rgba(15,17,23,0.8)"
            />
          </ReactFlow>
        </div>

        <NodeConfigPanel
          node={selectedNode}
          onChange={handleNodeChange}
          onDelete={handleNodeDelete}
          onClose={() => setSelectedNode(null)}
        />
      </div>

      {/* Run modal */}
      <Modal open={showRun} onClose={() => setShowRun(false)} title={`Run "${current.name}"`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#8891a8] mb-1.5">Task / Prompt</label>
            <textarea className="input resize-none h-28"
              placeholder="Describe what you want the agents to do…"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowRun(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleRun} disabled={running || !taskInput.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {running && <Spinner size="sm" />}
              {running ? 'Starting…' : '▷ Run'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function WorkflowBuilderPage() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  )
}
