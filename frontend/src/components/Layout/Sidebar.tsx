import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Settings,
  User,
  Plug,
  ChevronLeft,
  ChevronRight,
  Zap,
  Database,
  BarChart2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useT } from '@/i18n'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

interface NavItem {
  to: string
  labelKey: keyof ReturnType<typeof useT>['nav']
  icon: LucideIcon
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/data', labelKey: 'data', icon: Database },
  { to: '/analysis', labelKey: 'analysis', icon: BarChart2 },
  { to: '/reports', labelKey: 'reports', icon: FileText },
  { to: '/plugins', labelKey: 'plugins', icon: Plug },
  { to: '/admin', labelKey: 'admin', icon: Settings, adminOnly: true },
  { to: '/profile', labelKey: 'profile', icon: User },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const t = useT()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 ease-in-out shrink-0',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-800 overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-white text-lg tracking-tight truncate">
              Nadin
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto overflow-x-hidden">
        {visibleItems.map(({ to, labelKey, icon: Icon }) => {
          const label = t.nav[labelKey]
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-800/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent',
                  collapsed && 'justify-center px-0',
                )
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* User info at bottom */}
      {!collapsed && user && (
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.username}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors z-10"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
