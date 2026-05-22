import apiClient from './client'
import type {
  User,
  PaginatedResponse,
  PaginationParams,
  AdminUserUpdatePayload,
  PasswordResetPayload,
  CreateUserPayload,
} from '@/types'

export const usersApi = {
  list: async (params?: PaginationParams & { page?: number; per_page?: number }): Promise<PaginatedResponse<User>> => {
    // Backend uses skip/limit; convert page/per_page if provided
    const { page, per_page, ...rest } = params ?? {}
    const skip = page && per_page ? (page - 1) * per_page : undefined
    const limit = per_page
    const { data } = await apiClient.get<PaginatedResponse<User>>('/users', {
      params: { skip, limit, ...rest },
    })
    return data
  },

  create: async (payload: CreateUserPayload): Promise<User> => {
    const { data } = await apiClient.post<User>('/users', payload)
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
