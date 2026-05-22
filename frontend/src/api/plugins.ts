import apiClient from './client'
import type { Plugin, PluginConfigPayload } from '@/types'

// Matches the actual backend PluginOut schema
interface BackendPlugin {
  id: number
  name: string
  slug: string
  version: string
  description: string | null
  plugin_type: string
  config: Record<string, unknown>
  integration_config: Record<string, unknown>
  is_enabled: boolean
  webhook_url: string | null
  created_at: string
  updated_at: string
}

interface BackendPluginList {
  total: number
  items: BackendPlugin[]
}

function toPlugin(p: BackendPlugin): Plugin {
  return {
    id: String(p.id),
    name: p.name,
    slug: p.slug,
    description: p.description ?? '',
    version: p.version,
    author: p.plugin_type,
    status: p.is_enabled ? 'enabled' : 'disabled',
    is_official: false,
    config_schema: null,
    config: p.config,
    icon_url: null,
    homepage_url: p.webhook_url,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

export const pluginsApi = {
  list: async (): Promise<Plugin[]> => {
    const { data } = await apiClient.get<BackendPluginList>('/plugins')
    return (data?.items ?? []).map(toPlugin)
  },

  get: async (id: string): Promise<Plugin> => {
    const { data } = await apiClient.get<BackendPlugin>(`/plugins/${id}`)
    return toPlugin(data)
  },

  // Backend uses PATCH, not POST
  enable: async (id: string): Promise<Plugin> => {
    const { data } = await apiClient.patch<BackendPlugin>(`/plugins/${id}/enable`)
    return toPlugin(data)
  },

  disable: async (id: string): Promise<Plugin> => {
    const { data } = await apiClient.patch<BackendPlugin>(`/plugins/${id}/disable`)
    return toPlugin(data)
  },

  configure: async (id: string, payload: PluginConfigPayload): Promise<Plugin> => {
    const { data } = await apiClient.patch<BackendPlugin>(`/plugins/${id}`, payload)
    return toPlugin(data)
  },
}
