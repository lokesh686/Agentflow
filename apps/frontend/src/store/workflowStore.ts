import { create } from 'zustand'
import api from '../lib/api'

export interface WorkflowNode {
  id: string
  type: string
  label: string
  position: { x: number; y: number }
  config: {
    systemPrompt?: string
    model?: string
    temperature?: number
    tools?: string[]
    maxTokens?: number
  }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  condition?: { type: string; value?: string }
  label?: string
}

export interface Workflow {
  _id: string
  name: string
  description: string
  status: 'draft' | 'active' | 'archived'
  tags: string[]
  version: number
  graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }
  stats: { totalExecutions: number; lastExecutedAt: string | null; successRate: number | null }
  createdAt: string
  updatedAt: string
}

interface WorkflowState {
  workflows: Workflow[]
  current: Workflow | null
  isLoading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
  fetch: (reset?: boolean) => Promise<void>
  fetchOne: (id: string) => Promise<void>
  create: (payload: Partial<Workflow>) => Promise<Workflow>
  update: (id: string, updates: Partial<Workflow>) => Promise<void>
  remove: (id: string) => Promise<void>
  execute: (id: string, input: Record<string, any>) => Promise<{ executionId: string }>
  setCurrent: (w: Workflow | null) => void
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  current: null,
  isLoading: false,
  error: null,
  hasMore: false,
  cursor: null,

  fetch: async (reset = false) => {
    set({ isLoading: true, error: null })
    try {
      const cursor = reset ? undefined : get().cursor
      const params: Record<string, any> = { limit: 20 }
      if (cursor) params.cursor = cursor
      const { data } = await api.get('/workflows', { params })
      set((s) => ({
        workflows: reset ? data.data : [...s.workflows, ...data.data],
        hasMore: data.meta.hasMore,
        cursor: data.meta.cursor,
        isLoading: false,
      }))
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to load workflows', isLoading: false })
    }
  },

  fetchOne: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.get(`/workflows/${id}`)
      set({ current: data.data, isLoading: false })
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Not found', isLoading: false })
    }
  },

  create: async (payload) => {
    const { data } = await api.post('/workflows', payload)
    set((s) => ({ workflows: [data.data, ...s.workflows] }))
    return data.data
  },

  update: async (id, updates) => {
    const { data } = await api.put(`/workflows/${id}`, updates)
    set((s) => ({
      workflows: s.workflows.map((w) => (w._id === id ? data.data : w)),
      current: s.current?._id === id ? data.data : s.current,
    }))
  },

  remove: async (id) => {
    await api.delete(`/workflows/${id}`)
    set((s) => ({ workflows: s.workflows.filter((w) => w._id !== id) }))
  },

  execute: async (id, input) => {
    const { data } = await api.post(`/workflows/${id}/execute`, { input })
    return data.data
  },

  setCurrent: (w) => set({ current: w }),
}))
