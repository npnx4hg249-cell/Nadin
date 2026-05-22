import apiClient from './client'
import type {
  PermissionProfile,
  PermissionProfilePayload,
  AuditLogEntry,
  PaginatedResponse,
  PaginationParams,
  DashboardStats,
  ActivityItem,
  DbStats,
  LlmSettings,
} from '@/types'

export const adminApi = {
  // ─── Dashboard ─────────────────────────────────────────────────────────
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await apiClient.get<DashboardStats>('/admin/stats')
    return data
  },

  getActivity: async (limit = 20): Promise<ActivityItem[]> => {
    const { data } = await apiClient.get<ActivityItem[]>('/admin/activity', {
      params: { limit },
    })
    return data
  },

  // ─── Permission Profiles ───────────────────────────────────────────────
  listProfiles: async (): Promise<PermissionProfile[]> => {
    const { data } = await apiClient.get<PermissionProfile[]>('/users/permission-profiles/')
    return data
  },

  getProfile: async (id: number): Promise<PermissionProfile> => {
    const { data } = await apiClient.get<PermissionProfile>(
      `/users/permission-profiles/${id}`,
    )
    return data
  },

  createProfile: async (payload: PermissionProfilePayload): Promise<PermissionProfile> => {
    const { data } = await apiClient.post<PermissionProfile>(
      '/users/permission-profiles/',
      payload,
    )
    return data
  },

  updateProfile: async (
    id: number,
    payload: PermissionProfilePayload,
  ): Promise<PermissionProfile> => {
    const { data } = await apiClient.patch<PermissionProfile>(
      `/users/permission-profiles/${id}`,
      payload,
    )
    return data
  },

  deleteProfile: async (id: number): Promise<void> => {
    await apiClient.delete(`/users/permission-profiles/${id}`)
  },

  // ─── Audit Log ─────────────────────────────────────────────────────────
  getAuditLog: async (
    params?: PaginationParams & {
      action?: string
      actor_id?: string
      from_date?: string
      to_date?: string
    },
  ): Promise<PaginatedResponse<AuditLogEntry>> => {
    const { data } = await apiClient.get<PaginatedResponse<AuditLogEntry>>(
      '/admin/audit-log',
      { params },
    )
    return data
  },

  // ─── Database Stats ────────────────────────────────────────────────────
  getDbStats: async (): Promise<DbStats> => {
    const { data } = await apiClient.get<DbStats>('/admin/db-stats')
    return data
  },

  // ─── LLM Settings ─────────────────────────────────────────────────────
  getLlmSettings: async (): Promise<LlmSettings> => {
    const { data } = await apiClient.get<LlmSettings>('/admin/llm-settings')
    return data
  },

  updateLlmSettings: async (payload: Partial<LlmSettings>): Promise<LlmSettings> => {
    const { data } = await apiClient.patch<LlmSettings>('/admin/llm-settings', payload)
    return data
  },
}
