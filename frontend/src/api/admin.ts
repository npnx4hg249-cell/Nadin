import apiClient from './client'
import type {
  PermissionProfile,
  PermissionProfilePayload,
  AuditLogEntry,
  PaginatedResponse,
  PaginationParams,
  DashboardStats,
  ActivityItem,
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
    const { data } = await apiClient.get<PermissionProfile[]>('/admin/permission-profiles')
    return data
  },

  getProfile: async (id: string): Promise<PermissionProfile> => {
    const { data } = await apiClient.get<PermissionProfile>(
      `/admin/permission-profiles/${id}`,
    )
    return data
  },

  createProfile: async (payload: PermissionProfilePayload): Promise<PermissionProfile> => {
    const { data } = await apiClient.post<PermissionProfile>(
      '/admin/permission-profiles',
      payload,
    )
    return data
  },

  updateProfile: async (
    id: string,
    payload: PermissionProfilePayload,
  ): Promise<PermissionProfile> => {
    const { data } = await apiClient.put<PermissionProfile>(
      `/admin/permission-profiles/${id}`,
      payload,
    )
    return data
  },

  deleteProfile: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/permission-profiles/${id}`)
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
}
