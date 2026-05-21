import { LogIn, LogOut, AlertTriangle, Shield, Key, FileText, Plug, Settings, User } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { ActivityItem, AuditAction } from '@/types'

interface ActivityFeedProps {
  items: ActivityItem[]
  loading?: boolean
}

const actionConfig: Record<AuditAction, { icon: React.FC<{ size?: number }>, label: string }> = {
  'user.login': { icon: LogIn, label: 'User logged in' },
  'user.logout': { icon: LogOut, label: 'User logged out' },
  'user.login_failed': { icon: AlertTriangle, label: 'Login failed' },
  'user.2fa_enabled': { icon: Shield, label: '2FA enabled' },
  'user.2fa_disabled': { icon: Shield, label: '2FA disabled' },
  'user.password_changed': { icon: Key, label: 'Password changed' },
  'user.created': { icon: User, label: 'User created' },
  'user.updated': { icon: User, label: 'User updated' },
  'user.deleted': { icon: User, label: 'User deleted' },
  'report.created': { icon: FileText, label: 'Report created' },
  'report.updated': { icon: FileText, label: 'Report updated' },
  'report.deleted': { icon: FileText, label: 'Report deleted' },
  'report.run': { icon: FileText, label: 'Report executed' },
  'plugin.enabled': { icon: Plug, label: 'Plugin enabled' },
  'plugin.disabled': { icon: Plug, label: 'Plugin disabled' },
  'plugin.configured': { icon: Plug, label: 'Plugin configured' },
  'admin.settings_changed': { icon: Settings, label: 'Settings changed' },
}

const severityStyles = {
  info: 'bg-blue-900/30 border-blue-800 text-blue-400',
  warning: 'bg-amber-900/30 border-amber-800 text-amber-400',
  error: 'bg-red-900/30 border-red-800 text-red-400',
}

function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-48 bg-gray-700 rounded animate-pulse" />
        <div className="h-3 w-32 bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="h-3 w-12 bg-gray-700 rounded animate-pulse" />
    </div>
  )
}

export function ActivityFeed({ items, loading }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="divide-y divide-gray-700/50">
        {Array.from({ length: 6 }).map((_, i) => (
          <ActivityItemSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-gray-500 text-sm">
        No recent activity
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-700/50">
      {items.map((item) => {
        const config = actionConfig[item.action] || { icon: Settings, label: item.action }
        const Icon = config.icon
        const severityStyle = severityStyles[item.severity]

        return (
          <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div
              className={cn(
                'w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5',
                severityStyle,
              )}
            >
              <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 leading-snug">{item.description}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.actor_email}</p>
            </div>
            <span className="text-xs text-gray-500 shrink-0 mt-0.5">
              {formatRelativeTime(item.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
