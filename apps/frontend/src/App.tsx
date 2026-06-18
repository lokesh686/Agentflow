import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import MonitorPage from './pages/MonitorPage';
import TemplatesPage from './pages/workflows/TemplatesPage';
import WebhookSettingsPage from './pages/workflows/WebhookSettingsPage';
import WorkflowsPage from './pages/workflows/WorkflowsPage';
import WorkflowDetailPage from './pages/workflows/WorkflowDetailPage';
import WorkflowBuilderPage from './pages/workflows/builder/WorkflowBuilderPage';
import ExecutionsPage from './pages/executions/ExecutionsPage';
import ExecutionDetailPage from './pages/executions/ExecutionDetailPage';
import BillingPage from './pages/billing/BillingPage';
import EvalsPage from './pages/evals/EvalsPage';
import DashboardPage from './pages/DashboardPage';
import DashboardLayout from './components/layout/DashboardLayout';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import RegisterPage from './pages/auth/RegisterPage';
import LoginPage from './pages/auth/LoginPage';
import TeamSettingsPage from './pages/auth/TeamSettingsPage';
import TeamJoinPage from './pages/auth/TeamJoinPage';
import ErrorBoundary from './components/ErrorBoundary';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuthStore()
  if (!user && !accessToken) return <Navigate to="/login" replace />
  return <>{children}</>
}

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
          <Route path="/team/join" element={<TeamJoinPage />} />

          {/* Protected */}
          <Route path="/" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="team" element={<TeamSettingsPage />} />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="workflows/:id" element={<WorkflowDetailPage />} />
            <Route path="workflows/:id/builder" element={<WorkflowBuilderPage />} />
            <Route path="workflows/:id/webhook" element={<WebhookSettingsPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="executions" element={<ExecutionsPage />} />
            <Route path="executions/:id" element={<ExecutionDetailPage />} />
            <Route path="evals" element={<EvalsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="monitor" element={<MonitorPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
