import { useState } from 'react'
import { Activity, Shield, Users } from 'lucide-react'
import { UserTable } from '@/components/admin/UserTable'
import { PermissionProfileForm } from '@/components/admin/PermissionProfileForm'
import { AuditLogTable } from '@/components/admin/AuditLogTable'

type Tab = 'users' | 'profiles' | 'audit'

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'profiles', label: 'Permission Profiles', icon: Shield },
  { id: 'audit', label: 'Audit Log', icon: Activity },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
        <p className="mt-1 text-sm text-gray-400">Manage users, permissions, and system activity</p>
      </div>

      <div className="border-b border-gray-800">
        <nav className="-mb-px flex gap-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {activeTab === 'users' && <UserTable />}
        {activeTab === 'profiles' && <PermissionProfileForm />}
        {activeTab === 'audit' && <AuditLogTable />}
      </div>
    </div>
  )
}
