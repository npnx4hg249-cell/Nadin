import apiClient from './client'

export interface NlToSqlRequest {
  question: string
  dataset_id: number
  schema_context?: string
}

export interface NlToSqlResponse {
  sql: string
  model: string
  prompt_tokens?: number
}

export interface LlmHealthResponse {
  enabled: boolean
  reachable: boolean
  model: string
  error?: string
}

export const llmApi = {
  health: async (): Promise<LlmHealthResponse> => {
    const { data } = await apiClient.get<LlmHealthResponse>('/llm/health')
    return data
  },

  nlToSql: async (req: NlToSqlRequest): Promise<NlToSqlResponse> => {
    const { data } = await apiClient.post<NlToSqlResponse>('/llm/nl-to-sql', req)
    return data
  },
}
