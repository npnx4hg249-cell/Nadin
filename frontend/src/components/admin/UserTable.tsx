import { Shield, ShieldOff, Lock, UserCheck, UserX, Trash2, Edit2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { formatDateTime } from '@/lib/utils'
import type { User } from '@/types'

interface UserTableProps {
  users: User[]
  loading: boolean
  onEdit: (user: User) => void
  onResetPassword: (user: User) => void
  onForce2fa: (user: User) => void
  onToggleActive: (user: User) => void
  onDelete: (user: User) => void
}

export function UserTable({
  users,
  loading,
  onEdit,
  onResetPassword,
  onForce2fa,
  onToggleActive,
  onDelete,
}: UserTableProps) {
  const columns = [
    {
      key: 'full_name',
      header: 'User',
      sortable: true,
      render: (user: User) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {user.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-white">{user.full_name}</div>
            <div className="text-xs text-gray-500">{user.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      width: '100px',
      render: (user: User) => (
        <Badge variant={user.role === 'admin' ? 'info' : user.role === 'viewer' ? 'default' : 'purple'}>
          {user.role}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '100px',
      render: (user: User) => (
        <Badge variant={user.is_active ? 'success' : 'error'} dot>
          {user.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'is_2fa_enabled',
      header: '2FA',
      width: '80px',
      render: (user: User) => (
        <Badge variant={user.is_2fa_enabled ? 'success' : 'warning'}>
          {user.is_2fa_enabled ? 'On' : 'Off'}
        </Badge>
      ),
    },
    {
      key: 'last_login',
      header: 'Last login',
      sortable: true,
      width: '160px',
      render: (user: User) => (
        <span className="text-gray-400">{formatDateTime(user.last_login)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '200px',
      render: (user: User) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(user)}
            className="p-1.5 rounded text-gray-500 hover:text-blue-400 hover:bg-gray-700 transition-colors"
            title="Edit user"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onResetPassword(user)}
            className="p-1.5 rounded text-gray-500 hover:text-amber-400 hover:bg-gray-700 transition-colors"
            title="Reset password"
          >
            <Lock size={14} />
          </button>
          <button
            onClick={() => onForce2fa(user)}
            className="p-1.5 rounded text-gray-500 hover:text-purple-400 hover:bg-gray-700 transition-colors"
            title="Force 2FA enrollment"
          >
            <Shield size={14} />
          </button>
          <button
            onClick={() => onToggleActive(user)}
            className={`p-1.5 rounded transition-colors ${
              user.is_active
                ? 'text-gray-500 hover:text-orange-400 hover:bg-gray-700'
                : 'text-gray-500 hover:text-emerald-400 hover:bg-gray-700'
            }`}
            title={user.is_active ? 'Disable user' : 'Enable user'}
          >
            {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
          </button>
          <button
            onClick={() => onDelete(user)}
            className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors"
            title="Delete user"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      data={users}
      keyExtractor={(u) => u.id}
      loading={loading}
      emptyMessage="No users found."
    />
  )
}
