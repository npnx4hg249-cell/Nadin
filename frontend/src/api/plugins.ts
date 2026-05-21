import apiClient from './client'
import type { Plugin, PluginConfigPayload } from '@/types'

export const pluginsApi = {
  list: async (): Promise<Plugin[]> => {
    const { data } = await apiClient.get<Plugin[]>('/plugins')
    return data
  },

  get: async (id: string): Promise<Plugin> => {
    const { data } = await apiClient.get<Plugin>(`/plugins/${id}`)
    return data
  },

  enable: async (id: string): Promise<Plugin> => {
    const { data } = await apiClient.post<Plugin>(`/plugins/${id}/enable`)
    return data
  },

  disable: async (id: string): Promise<Plugin> => {
    const { data } = await apiClient.post<Plugin>(`/plugins/${id}/disable`)
    return data
  },

  configure: async (id: string, payload: PluginConfigPayload): Promise<Plugin> => {
    const { data } = await apiClient.patch<Plugin>(`/plugins/${id}/config`, payload)
    return data
  },
}
