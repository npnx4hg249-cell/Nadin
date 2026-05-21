import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import AppLayout from '@/components/Layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import SetupTwoFactorPage from '@/pages/SetupTwoFactorPage'
import DashboardPage from '@/pages/DashboardPage'
import ReportsPage from '@/pages/ReportsPage'
import AdminPage from '@/pages/AdminPage'
import ProfilePage from '@/pages/ProfilePage'
import NotFoundPage from '@/pages/NotFoundPage'
import { Spinner } from '@/components/ui/Spinner'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return <div className="flex h-screen items-center justify-center bg-gray-900"><Spinner size="lg" /></div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user || !['admin', 'super_admin'].includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { isDark } = useThemeStore()
  const { setUser, setLoading, clearUser } = useAuthStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  useEffect(() => {
    authApi.me()
      .then((user) => setUser(user, ''))
      .catch(() => { clearUser(); setLoading(false) })
  }, [])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'dark:bg-gray-800 dark:text-white',
          duration: 4000,
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup-2fa" element={<SetupTwoFactorPage />} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
