import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/reports': 'Reports',
  '/admin': 'Administration',
  '/profile': 'Profile',
  '/plugins': 'Plugins',
  '/setup-2fa': 'Two-Factor Authentication',
}

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()

  const pageTitle = PAGE_TITLES[location.pathname] || ''

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar title={pageTitle} />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-950">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
