import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import { tokenStore } from '@/api/client'
import type { LoginCredentials } from '@/types'

export function useAuth() {
  const { user, isAuthenticated, isLoading, pendingTwoFactor, setUser, clearUser, setLoading } = useAuthStore()
  const navigate = useNavigate()

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const { access_token } = await authApi.login(credentials)
      tokenStore.set(access_token)
      const user = await authApi.me()
      setUser(user, access_token)
      toast.success(`Welcome back, ${user.username}!`)
      navigate('/dashboard')
    },
    [setUser, navigate],
  )

  const verify2fa = useCallback(
    async (code: string, email: string) => {
      const { access_token } = await authApi.verify2fa({ code, email })
      tokenStore.set(access_token)
      const user = await authApi.me()
      setUser(user, access_token)
      toast.success(`Welcome back, ${user.username}!`)
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
