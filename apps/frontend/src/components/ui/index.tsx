import { ReactNode } from 'react'

// ── StatusBadge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  QUEUED:    'bg-yellow-500/10 text-yellow-400',
  RUNNING:   'bg-blue-500/10 text-blue-400',
  PAUSED:    'bg-orange-500/10 text-orange-400',
  COMPLETED: 'bg-green-500/10 text-green-400',
  FAILED:    'bg-red-500/10 text-red-400',
  CANCELLED: 'bg-gray-500/10 text-gray-400',
  RETRYING:  'bg-purple-500/10 text-purple-400',
  draft:     'bg-gray-500/10 text-gray-400',
  active:    'bg-green-500/10 text-green-400',
  archived:  'bg-gray-500/10 text-gray-500',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? 'bg-gray-500/10 text-gray-400'}`}>
      {status === 'RUNNING' && (
        <span className="mr-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      )}
      {status}
    </span>
  )
}

// ── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size]
  return (
    <div className={`${s} border-2 border-[#2e3347] border-t-brand-500 rounded-full animate-spin`} />
  )
}

// ── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({
  icon, title, description, action,
}: { icon: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl mb-4 opacity-30">{icon}</div>
      <h3 className="text-lg font-semibold text-[#e8eaf0] mb-1">{title}</h3>
      <p className="text-sm text-[#8891a8] max-w-sm mb-6">{description}</p>
      {action}
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function Modal({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg mx-4 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[#e8eaf0]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#8891a8] hover:text-[#e8eaf0] transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── PageHeader ───────────────────────────────────────────────────────────────

export function PageHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-[#e8eaf0]">{title}</h1>
        {subtitle && <p className="text-sm text-[#8891a8] mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── ErrorBanner ──────────────────────────────────────────────────────────────

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
      {message}
    </div>
  )
}
