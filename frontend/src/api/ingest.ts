import apiClient from './client'

export interface ColumnInfo {
  name: string
  dtype: string
  nullable: boolean
}

export interface SchemaInfo {
  columns: ColumnInfo[]
}

export interface Dataset {
  id: number
  name: string
  description: string | null
  owner_id: number | null
  original_filename: string
  original_format: string
  row_count: number | null
  column_count: number | null
  file_size_bytes: number | null
  schema_info: { columns: ColumnInfo[] } | null
  status: 'pending' | 'processing' | 'ready' | 'error'
  error_message: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface DatasetList {
  total: number
  items: Dataset[]
}

export const ingestApi = {
  uploadDataset: async (
    file: File,
    name: string,
    description?: string,
    is_public?: boolean,
    translate_to?: 'en' | 'de',
  ): Promise<Dataset> => {
    const form = new FormData()
    form.append('file', file)
    form.append('name', name)
    if (description) form.append('description', description)
    if (is_public !== undefined) form.append('is_public', String(is_public))
    if (translate_to) form.append('translate_to', translate_to)
    const { data } = await apiClient.post<Dataset>('/datasets', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  listDatasets: async (params?: { skip?: number; limit?: number }): Promise<DatasetList> => {
    const { data } = await apiClient.get<DatasetList>('/datasets', { params })
    return data
  },

  getDataset: async (id: number): Promise<Dataset> => {
    const { data } = await apiClient.get<Dataset>(`/datasets/${id}`)
    return data
  },

  updateDataset: async (
    id: number,
    payload: { name?: string; description?: string; is_public?: boolean },
  ): Promise<Dataset> => {
    const { data } = await apiClient.patch<Dataset>(`/datasets/${id}`, payload)
    return data
  },

  deleteDataset: async (id: number): Promise<void> => {
    await apiClient.delete(`/datasets/${id}`)
  },
}
