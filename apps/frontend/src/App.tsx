import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// Auth pages
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import VerifyEmailPage from './pages/auth/VerifyEmailPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'

// App pages
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './pages/DashboardPage'
import WorkflowsPage from './pages/workflows/WorkflowsPage'
import WorkflowDetailPage from './pages/workflows/WorkflowDetailPage'
import WorkflowBuilderPage from './pages/workflows/builder/WorkflowBuilderPage'
import ExecutionsPage from './pages/executions/ExecutionsPage'
import ExecutionDetailPage from './pages/executions/ExecutionDetailPage'
import BillingPage from './pages/billing/BillingPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuthStore()
  if (!user && !accessToken) return <Navigate to="/login" replace />
  return <>{children}</>
}

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const { hydrate } = useAuthStore()

  useEffect(() => {
    hydrate()
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected */}
          <Route path="/" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="workflows/:id" element={<WorkflowDetailPage />} />
            <Route path="workflows/:id/builder" element={<WorkflowBuilderPage />} />
            <Route path="executions" element={<ExecutionsPage />} />
            <Route path="executions/:id" element={<ExecutionDetailPage />} />
            <Route path="billing" element={<BillingPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
