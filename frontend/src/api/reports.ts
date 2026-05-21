import apiClient from './client'
import type {
  Report,
  ReportCreatePayload,
  ReportUpdatePayload,
  ReportRunResult,
  PaginatedResponse,
  PaginationParams,
} from '@/types'

export const reportsApi = {
  list: async (params?: PaginationParams & { status?: string; type?: string }): Promise<PaginatedResponse<Report>> => {
    const { data } = await apiClient.get<PaginatedResponse<Report>>('/reports', { params })
    return data
  },

  get: async (id: string): Promise<Report> => {
    const { data } = await apiClient.get<Report>(`/reports/${id}`)
    return data
  },

  create: async (payload: ReportCreatePayload): Promise<Report> => {
    const { data } = await apiClient.post<Report>('/reports', payload)
    return data
  },

  update: async (id: string, payload: ReportUpdatePayload): Promise<Report> => {
    const { data } = await apiClient.patch<Report>(`/reports/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/reports/${id}`)
  },

  run: async (id: string): Promise<ReportRunResult> => {
    const { data } = await apiClient.post<ReportRunResult>(`/reports/${id}/run`)
    return data
  },

  export: async (id: string, format: 'csv' | 'json' | 'pdf'): Promise<Blob> => {
    const { data } = await apiClient.get(`/reports/${id}/export`, {
      params: { format },
      responseType: 'blob',
    })
    return data
  },
}
