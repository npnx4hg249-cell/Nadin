import apiClient from './client'
import type { MetricDef } from './engine'

export type { MetricDef }

export interface ChartRequest {
  chart_type: string
  columns: string[]
  rows: unknown[][]
  title?: string
  x_label?: string
  y_label?: string
}

export interface ChartResult {
  plotly_json: {
    data: unknown[]
    layout: Record<string, unknown>
  }
}

export interface PdfSection {
  type: 'text' | 'heading' | 'table'
  content?: string
  heading?: string
  columns?: string[]
  rows?: unknown[][]
}

export interface GrafanaPanel {
  title: string
  type: string
  metrics: MetricDef[]
  group_by?: string[]
}

export const outputApi = {
  generateChart: async (req: ChartRequest): Promise<ChartResult> => {
    const { data } = await apiClient.post<ChartResult>('/output/chart', req)
    return data
  },

  generateGrafana: async (panels: GrafanaPanel[]): Promise<Blob> => {
    const { data } = await apiClient.post('/output/grafana', { panels }, { responseType: 'blob' })
    return data
  },

  generatePdf: async (sections: PdfSection[]): Promise<Blob> => {
    const { data } = await apiClient.post('/output/pdf', { sections }, { responseType: 'blob' })
    return data
  },

  exportCsv: async (columns: string[], rows: unknown[][]): Promise<Blob> => {
    const { data } = await apiClient.post('/output/csv', { columns, rows }, { responseType: 'blob' })
    return data
  },
}
