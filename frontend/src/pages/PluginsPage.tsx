import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plug, CheckCircle, XCircle, ExternalLink, Search } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { pluginsApi } from '@/api/plugins'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'
import type { Plugin } from '@/types'

export function PluginsPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: plugins = [], isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: pluginsApi.list,
  })

  const enableMutation = useMutation({
    mutationFn: (id: string) => pluginsApi.enable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      toast.success('Plugin enabled')
    },
    onError: () => toast.error('Failed to enable plugin'),
  })

  const disableMutation = useMutation({
    mutationFn: (id: string) => pluginsApi.disable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      toast.success('Plugin disabled')
    },
    onError: () => toast.error('Failed to disable plugin'),
  })

  const filtered = plugins.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()),
  )

  const enabledPlugins = filtered.filter((p) => p.status === 'enabled')
  const disabledPlugins = filtered.filter((p) => p.status !== 'enabled')

  const renderPlugin = (plugin: Plugin) => (
    <Card key={plugin.id} className="hover:border-gray-600 transition-colors">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gray-700 border border-gray-600 flex items-center justify-center shrink-0">
          {plugin.icon_url ? (
            <img src={plugin.icon_url} alt={plugin.name} className="w-7 h-7 rounded" />
          ) : (
            <Plug size={22} className="text-gray-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-white">{plugin.name}</h3>
                {plugin.is_official && (
                  <Badge variant="info">Official</Badge>
                )}
                <Badge
                  variant={plugin.status === 'enabled' ? 'success' : plugin.status === 'error' ? 'error' : 'default'}
                  dot
                >
                  {plugin.status}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                v{plugin.version} · by {plugin.author}
              </p>
            </div>
          </div>

          {plugin.description && (
            <p className="text-sm text-gray-400 mt-2 line-clamp-2">{plugin.description}</p>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {isAdmin && (
              plugin.status === 'enabled' ? (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<XCircle size={13} />}
                  loading={disableMutation.isPending}
                  onClick={() => disableMutation.mutate(plugin.id)}
                >
                  Disable
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CheckCircle size={13} />}
                  loading={enableMutation.isPending}
                  onClick={() => enableMutation.mutate(plugin.id)}
                >
                  Enable
                </Button>
              )
            )}
            {plugin.homepage_url && (
              <a
                href={plugin.homepage_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink size={12} />
                Learn more
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Plugins</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {plugins.filter((p) => p.status === 'enabled').length} of {plugins.length} plugins enabled
          </p>
        </div>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Search plugins..."
          leftIcon={<Search size={14} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-gray-500">
            <Plug size={40} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm">
              {search ? 'No plugins match your search.' : 'No plugins installed.'}
            </p>
          </div>
        </Card>
      ) : (
        <>
          {enabledPlugins.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                Active ({enabledPlugins.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enabledPlugins.map(renderPlugin)}
              </div>
            </div>
          )}

          {disabledPlugins.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                Inactive ({disabledPlugins.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
                {disabledPlugins.map(renderPlugin)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
