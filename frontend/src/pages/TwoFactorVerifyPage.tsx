import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'
import { TwoFactorForm } from '@/components/auth/TwoFactorForm'
import { useAuthStore } from '@/store/authStore'

export function TwoFactorVerifyPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const pendingTwoFactor = useAuthStore((s) => s.pendingTwoFactor)

  const email: string = location.state?.email || pendingTwoFactor?.email || ''

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
      return
    }
    if (!email) {
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, email, navigate])

  if (!email) return null

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Nadin</h1>
              <p className="text-xs text-gray-500">Two-Factor Verification</p>
            </div>
          </div>

          <TwoFactorForm email={email} />

          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  )
}
