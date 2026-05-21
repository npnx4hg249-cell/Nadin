import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { User } from '@/types'
import { tokenStore } from '@/api/client'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  pendingTwoFactor: { email: string } | null
  isLoading: boolean

  setUser: (user: User, token: string) => void
  clearUser: () => void
  setPendingTwoFactor: (data: { email: string } | null) => void
  setLoading: (loading: boolean) => void
  updateUser: (updates: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      isAuthenticated: false,
      pendingTwoFactor: null,
      isLoading: true,

      setUser: (user, token) => {
        tokenStore.set(token)
        set({ user, isAuthenticated: true, isLoading: false, pendingTwoFactor: null })
      },

      clearUser: () => {
        tokenStore.clear()
        set({ user: null, isAuthenticated: false, isLoading: false, pendingTwoFactor: null })
      },

      setPendingTwoFactor: (data) => {
        set({ pendingTwoFactor: data })
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      updateUser: (updates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }))
      },
    }),
    { name: 'auth-store' },
  ),
)
