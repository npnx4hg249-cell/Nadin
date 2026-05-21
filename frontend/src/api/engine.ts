import apiClient from './client'

export interface QueryResult {
  columns: string[]
  rows: (string | number | boolean | null)[][]
  row_count: number
  truncated: boolean
}

export interface MetricDef {
  column: string
  function: string
  alias?: string
}

export interface FilterDef {
  column: string
  op: string
  value: unknown
}

export interface AggregateRequest {
  dataset_id: number
  group_by?: string[]
  metrics: MetricDef[]
  filters?: FilterDef[]
  limit?: number
}

export const engineApi = {
  previewDataset: async (dataset_id: number, limit = 100): Promise<QueryResult> => {
    const { data } = await apiClient.get<QueryResult>(
      `/engine/datasets/${dataset_id}/preview`,
      { params: { limit } },
    )
    return data
  },

  queryDataset: async (
    dataset_id: number,
    sql: string,
    limit?: number,
  ): Promise<QueryResult> => {
    const { data } = await apiClient.post<QueryResult>('/engine/query', {
      dataset_id,
      sql,
      limit,
    })
    return data
  },

  aggregateDataset: async (req: AggregateRequest): Promise<QueryResult> => {
    const { data } = await apiClient.post<QueryResult>('/engine/aggregate', req)
    return data
  },
}
