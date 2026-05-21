import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import type { LoginCredentials } from '@/types'

export function useAuth() {
  const { user, isAuthenticated, isLoading, pendingTwoFactor, setUser, clearUser, setPendingTwoFactor, setLoading } =
    useAuthStore()
  const navigate = useNavigate()

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const response = await authApi.login(credentials)
      if (response.requires_2fa) {
        setPendingTwoFactor({ email: credentials.email })
        navigate('/2fa-verify', { state: { email: credentials.email } })
      } else {
        setUser(response.user, response.access_token)
        toast.success(`Welcome back, ${response.user.full_name.split(' ')[0]}!`)
        navigate('/dashboard')
      }
    },
    [setPendingTwoFactor, setUser, navigate],
  )

  const verify2fa = useCallback(
    async (code: string, email: string) => {
      const response = await authApi.verify2fa({ code, email })
      setUser(response.user, response.access_token)
      toast.success(`Welcome back, ${response.user.full_name.split(' ')[0]}!`)
      navigate('/dashboard')
    },
    [setUser, navigate],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore errors on logout
    } finally {
      clearUser()
      navigate('/login')
    }
  }, [clearUser, navigate])

  const initAuth = useCallback(async () => {
    setLoading(true)
    try {
      const token = await authApi.refreshToken()
      const user = await authApi.me()
      setUser(user, token.access_token)
    } catch {
      clearUser()
    }
  }, [setUser, clearUser, setLoading])

  return {
    user,
    isAuthenticated,
    isLoading,
    pendingTwoFactor,
    login,
    verify2fa,
    logout,
    initAuth,
  }
}
