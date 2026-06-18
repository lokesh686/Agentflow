import { create } from 'zustand'
import api from '../lib/api'
import { getSocket, joinExecution, leaveExecution } from '../lib/socket'

export interface ExecutionStep {
  agentName: string
  nodeId: string
  type: string
  input?: any
  output?: any
  tokensUsed?: { prompt: number; completion: number; total: number }
  latencyMs?: number
  error?: string | null
  timestamp: string
}

export interface Execution {
  _id: string
  workflowId: string
  status: 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'CANCELLED' | 'WAITING_FOR_APPROVAL'
  input: Record<string, any>
  steps: ExecutionStep[]
  finalOutput: string | null
  totalTokens: { prompt: number; completion: number; total: number }
  estimatedCostUsd: number
  durationMs: number | null
  error: string | null
  humanApproval?: {
    required: boolean
    agentName: string
    context: string
    options: string[]
    decision: string | null
  }
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

interface ExecutionState {
  executions: Execution[]
  current: Execution | null
  isLoading: boolean
  streamingSteps: ExecutionStep[]
  fetch: (workflowId?: string) => Promise<void>
  fetchOne: (id: string) => Promise<void>
  subscribe: (id: string) => () => void
  cancel: (id: string) => Promise<void>
  approve: (id: string, decision: 'approved' | 'rejected') => Promise<void>
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  executions: [],
  current: null,
  isLoading: false,
  streamingSteps: [],

  fetch: async (workflowId) => {
    set({ isLoading: true })
    try {
      const params: any = {}
      if (workflowId) params.workflowId = workflowId
      const { data } = await api.get('/executions', { params })
      set({ executions: data.data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  fetchOne: async (id) => {
    set({ isLoading: true, streamingSteps: [] })
    try {
      const { data } = await api.get(`/executions/${id}`)
      set({ current: data.data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  // Subscribe to real-time events for an execution — returns cleanup fn
  subscribe: (id) => {
    joinExecution(id)
    const socket = getSocket()

    const onStep = (payload: any) => {
      set((s) => ({
        streamingSteps: [...s.streamingSteps, payload.step],
        current: s.current
          ? { ...s.current, steps: [...s.current.steps, payload.step] }
          : s.current,
      }))
    }

    const onStatus = (payload: any) => {
      set((s) => ({
        current: s.current ? { ...s.current, status: payload.status } : s.current,
        executions: s.executions.map((e) =>
          e._id === id ? { ...e, status: payload.status } : e
        ),
      }))
    }

    const onDone = (payload: any) => {
      set((s) => ({
        current: s.current
          ? { ...s.current, status: 'COMPLETED', finalOutput: payload.finalOutput,
              estimatedCostUsd: payload.estimatedCostUsd }
          : s.current,
      }))
    }

    const onError = (payload: any) => {
      set((s) => ({
        current: s.current
          ? { ...s.current, status: 'FAILED', error: payload.error }
          : s.current,
      }))
    }

    const onApproval = (payload: any) => {
      set((s) => ({
        current: s.current
          ? { ...s.current, status: 'PAUSED',
              humanApproval: { required: true, decision: null, ...payload } }
          : s.current,
      }))
    }

    socket.on('execution:step', onStep)
    socket.on('execution:status', onStatus)
    socket.on('execution:done', onDone)
    socket.on('execution:error', onError)
    socket.on('execution:approval_required', onApproval)

    return () => {
      leaveExecution(id)
      socket.off('execution:step', onStep)
      socket.off('execution:status', onStatus)
      socket.off('execution:done', onDone)
      socket.off('execution:error', onError)
      socket.off('execution:approval_required', onApproval)
    }
  },

  cancel: async (id) => {
    await api.post(`/executions/${id}/cancel`)
    set((s) => ({
      current: s.current ? { ...s.current, status: 'CANCELLED' } : s.current,
    }))
  },

  approve: async (id, decision) => {
    await api.post(`/executions/${id}/approve`, { decision })
  },
}))
