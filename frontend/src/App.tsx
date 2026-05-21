import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import { tokenStore } from '@/api/client'
import { AppLayout } from '@/components/Layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { SetupTwoFactorPage } from '@/pages/SetupTwoFactorPage'
import { TwoFactorVerifyPage } from '@/pages/TwoFactorVerifyPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { AdminPage } from '@/pages/AdminPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { PluginsPage } from '@/pages/PluginsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { DataPage } from '@/pages/DataPage'
import { AnalysisPage } from '@/pages/AnalysisPage'
import { PageSpinner } from '@/components/ui/Spinner'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <PageSpinner />
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user || !['admin', 'super_admin'].includes(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const theme = useThemeStore((s) => s.theme)
  const { setUser, setLoading, clearUser } = useAuthStore()

  // Apply theme class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Listen for global logout event (triggered by token refresh failure)
  useEffect(() => {
    const handleLogout = () => clearUser()
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [clearUser])

  // Initialize auth on mount: try token refresh, then fetch user
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true)
      try {
        const { access_token } = await authApi.refreshToken()
        tokenStore.set(access_token)
        const user = await authApi.me()
        setUser(user, access_token)
      } catch {
        clearUser()
      }
    }
    initAuth()
  }, [setUser, setLoading, clearUser])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#f3f4f6',
            border: '1px solid #374151',
            borderRadius: '10px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#f3f4f6' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#f3f4f6' },
          },
          duration: 4000,
        }}
      />

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/2fa-verify" element={<TwoFactorVerifyPage />} />

        {/* Protected routes */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="plugins" element={<PluginsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="setup-2fa" element={<SetupTwoFactorPage />} />
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
