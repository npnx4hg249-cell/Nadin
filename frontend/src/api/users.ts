import apiClient from './client'
import type {
  User,
  PaginatedResponse,
  PaginationParams,
  AdminUserUpdatePayload,
  PasswordResetPayload,
} from '@/types'

export const usersApi = {
  list: async (params?: PaginationParams): Promise<PaginatedResponse<User>> => {
    const { data } = await apiClient.get<PaginatedResponse<User>>('/users', { params })
    return data
  },

  get: async (id: string): Promise<User> => {
    const { data } = await apiClient.get<User>(`/users/${id}`)
    return data
  },

  update: async (id: string, payload: AdminUserUpdatePayload): Promise<User> => {
    const { data } = await apiClient.patch<User>(`/users/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`)
  },

  resetPassword: async (id: string, payload: PasswordResetPayload): Promise<void> => {
    await apiClient.post(`/users/${id}/reset-password`, payload)
  },

  force2fa: async (id: string): Promise<void> => {
    await apiClient.post(`/users/${id}/force-2fa`)
  },

  toggleActive: async (id: string, is_active: boolean): Promise<User> => {
    const { data } = await apiClient.patch<User>(`/users/${id}`, { is_active })
    return data
  },
}
