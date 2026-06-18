import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⬡' },
  { to: '/workflows', label: 'Workflows', icon: '◈' },
  { to: '/templates', label: 'Templates', icon: '📚' },
  { to: '/executions', label: 'Executions', icon: '▷' },
  { to: '/evals', label: 'Evaluations', icon: '🧪' },
  { to: '/monitor', label: 'Monitor', icon: '📈' },
  { to: '/billing', label: 'Billing', icon: '💳' },
  { to: '/team', label: 'Team & API', icon: '⚙' },
]

export default function DashboardLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f1117]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#1a1d27] border-r border-[#2e3347] flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-[#2e3347]">
          <span className="text-brand-500 text-xl font-bold tracking-tight">AgentFlow</span>
          <span className="text-[#8891a8] text-xl font-light ml-0.5">Pro</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-500/10 text-brand-500'
                    : 'text-[#8891a8] hover:text-[#e8eaf0] hover:bg-[#21263a]'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-[#2e3347] p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center
                            text-brand-500 font-semibold text-sm flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#e8eaf0] truncate">{user?.name}</p>
              <p className="text-xs text-[#8891a8] truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-1 text-left px-3 py-2 rounded-lg text-sm text-[#8891a8]
                       hover:text-[#e8eaf0] hover:bg-[#21263a] transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
