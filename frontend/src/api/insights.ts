import apiClient from './client'

export interface Insight {
  id: number
  name: string
  description: string | null
  dataset_id: number
  owner_id: number | null
  query_mode: string
  sql_query: string | null
  columns: string[] | null
  rows: unknown[][] | null
  row_count: number
  chart_type: string | null
  report_ids: number[] | null
  dashboard_ids: number[] | null
  created_at: string
  updated_at: string
}

export interface InsightCreate {
  name: string
  description?: string
  dataset_id: number
  query_mode: string
  sql_query?: string
  columns: string[]
  rows: unknown[][]
  row_count: number
  chart_type?: string
}

export interface InsightUpdate {
  name?: string
  description?: string
  chart_type?: string
}

export interface InsightAddToRequest {
  report_ids?: number[]
  dashboard_ids?: number[]
}

export interface InsightList {
  total: number
  items: Insight[]
}

export const insightsApi = {
  list: async (skip = 0, limit = 50): Promise<InsightList> => {
    const { data } = await apiClient.get<InsightList>('/analysis/insights', {
      params: { skip, limit },
    })
    return data
  },

  get: async (id: number): Promise<Insight> => {
    const { data } = await apiClient.get<Insight>(`/analysis/insights/${id}`)
    return data
  },

  create: async (payload: InsightCreate): Promise<Insight> => {
    const { data } = await apiClient.post<Insight>('/analysis/insights', payload)
    return data
  },

  update: async (id: number, payload: InsightUpdate): Promise<Insight> => {
    const { data } = await apiClient.patch<Insight>(`/analysis/insights/${id}`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/analysis/insights/${id}`)
  },

  addTo: async (id: number, payload: InsightAddToRequest): Promise<Insight> => {
    const { data } = await apiClient.post<Insight>(`/analysis/insights/${id}/add-to`, payload)
    return data
  },
}
