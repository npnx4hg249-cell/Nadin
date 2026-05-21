import apiClient from './client'
import type { MetricDef, FilterDef } from './engine'

export type { MetricDef, FilterDef }

export interface AnalysisRunRequest {
  dataset_id: number
  metrics: MetricDef[]
  group_by?: string[]
  filters?: FilterDef[]
  include_stats?: boolean
}

export interface AnalysisResult {
  columns: string[]
  rows: unknown[][]
  row_count: number
  stats?: Record<string, unknown>[]
}

export interface AnalysisConfig {
  id: number
  name: string
  description: string | null
  dataset_id: number
  owner_id: number | null
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AnalysisConfigList {
  total: number
  items: AnalysisConfig[]
}

export const analysisApi = {
  runAnalysis: async (req: AnalysisRunRequest): Promise<AnalysisResult> => {
    const { data } = await apiClient.post<AnalysisResult>('/analysis/run', req)
    return data
  },

  listConfigs: async (): Promise<AnalysisConfigList> => {
    const { data } = await apiClient.get<AnalysisConfigList>('/analysis/configs')
    return data
  },

  createConfig: async (
    payload: Omit<AnalysisConfig, 'id' | 'owner_id' | 'created_at' | 'updated_at'>,
  ): Promise<AnalysisConfig> => {
    const { data } = await apiClient.post<AnalysisConfig>('/analysis/configs', payload)
    return data
  },

  getConfig: async (id: number): Promise<AnalysisConfig> => {
    const { data } = await apiClient.get<AnalysisConfig>(`/analysis/configs/${id}`)
    return data
  },

  updateConfig: async (
    id: number,
    payload: Partial<Omit<AnalysisConfig, 'id' | 'owner_id' | 'created_at' | 'updated_at'>>,
  ): Promise<AnalysisConfig> => {
    const { data } = await apiClient.patch<AnalysisConfig>(`/analysis/configs/${id}`, payload)
    return data
  },

  deleteConfig: async (id: number): Promise<void> => {
    await apiClient.delete(`/analysis/configs/${id}`)
  },

  runConfig: async (id: number): Promise<AnalysisResult> => {
    const { data } = await apiClient.post<AnalysisResult>(`/analysis/configs/${id}/run`)
    return data
  },
}
