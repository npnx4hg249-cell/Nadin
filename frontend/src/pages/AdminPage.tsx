import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Shield, Activity, Plug, Plus, Search, Trash2, Settings, CheckCircle, XCircle, type LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { usersApi } from '@/api/users'
import { adminApi } from '@/api/admin'
import { pluginsApi } from '@/api/plugins'
import { UserTable } from '@/components/admin/UserTable'
import { UserEditModal } from '@/components/admin/UserEditModal'
import { PermissionProfileForm } from '@/components/admin/PermissionProfileForm'
import { AuditLogTable } from '@/components/admin/AuditLogTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Table'
import { ConfirmModal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import type { User, PermissionProfile, Plugin } from '@/types'

type Tab = 'users' | 'profiles' | 'audit' | 'plugins'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'profiles', label: 'Permission Profiles', icon: Shield },
  { id: 'audit', label: 'Audit Log', icon: Activity },
  { id: 'plugins', label: 'Plugins', icon: Plug },
]

// ─── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editMode, setEditMode] = useState<'edit' | 'reset-password' | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersApi.list({ page, per_page: 15, search: search || undefined }),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted')
      setDeletingUser(null)
    },
    onError: () => toast.error('Failed to delete user'),
  })

  const force2faMutation = useMutation({
    mutationFn: (id: string) => usersApi.force2fa(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('2FA enrollment required on next login')
    },
    onError: () => toast.error('Failed to set 2FA requirement'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      usersApi.toggleActive(id, is_active),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(`User ${user.is_active ? 'enabled' : 'disabled'}`)
    },
    onError: () => toast.error('Failed to update user status'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search users by name or email..."
            leftIcon={<Search size={14} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      <UserTable
        users={data?.items ?? []}
        loading={isLoading}
        onEdit={(user) => { setEditUser(user); setEditMode('edit') }}
        onResetPassword={(user) => { setEditUser(user); setEditMode('reset-password') }}
        onForce2fa={(user) => force2faMutation.mutate(String(user.id))}
        onToggleActive={(user) => toggleActiveMutation.mutate({ id: String(user.id), is_active: !user.is_active })}
        onDelete={setDeletingUser}
      />

      {data && data.pages > 1 && (
        <Pagination
          page={data.page}
          pages={data.pages}
          total={data.total}
          perPage={data.per_page}
          onPageChange={setPage}
        />
      )}

      <UserEditModal
        user={editUser}
        mode={editMode}
        onClose={() => { setEditUser(null); setEditMode(null) }}
      />

      <ConfirmModal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={() => deletingUser && deleteMutation.mutate(String(deletingUser.id))}
        title="Delete user"
        message={`Permanently delete "${deletingUser?.username}" (${deletingUser?.email})? This cannot be undone.`}
        confirmLabel="Delete user"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

// ─── Profiles Tab ───────────────────────────────────────────────────────────────

function ProfilesTab() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<PermissionProfile | null>(null)
  const [deletingProfile, setDeletingProfile] = useState<PermissionProfile | null>(null)

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['permission-profiles'],
    queryFn: adminApi.listProfiles,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-profiles'] })
      toast.success('Profile deleted')
      setDeletingProfile(null)
    },
    onError: () => toast.error('Failed to delete profile'),
  })

  const openCreate = () => { setEditingProfile(null); setFormOpen(true) }
  const openEdit = (p: PermissionProfile) => { setEditingProfile(p); setFormOpen(true) }

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button icon={<Plus size={16} />} onClick={openCreate}>
          New profile
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-gray-500">
            <Shield size={40} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm">No permission profiles yet. Create one to start.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white">{profile.name}</h3>
                  {profile.description && (
                    <p className="text-sm text-gray-400 mt-0.5">{profile.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {profile.permissions.slice(0, 4).map((perm) => (
                      <Badge key={perm} variant="info">{perm}</Badge>
                    ))}
                    {profile.permissions.length > 4 && (
                      <Badge variant="default">+{profile.permissions.length - 4} more</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {profile.user_count} user{profile.user_count !== 1 ? 's' : ''} assigned
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(profile)}
                    className="p-1.5 rounded text-gray-500 hover:text-blue-400 hover:bg-gray-700 transition-colors"
                    title="Edit"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={() => setDeletingProfile(profile)}
                    className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PermissionProfileForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingProfile(null) }}
        profile={editingProfile}
      />

      <ConfirmModal
        isOpen={!!deletingProfile}
        onClose={() => setDeletingProfile(null)}
        onConfirm={() => deletingProfile && deleteMutation.mutate(deletingProfile.id)}
        title="Delete permission profile"
        message={`Delete "${deletingProfile?.name}"? Users with this profile will lose their custom permissions.`}
        confirmLabel="Delete profile"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

// ─── Plugins Tab ────────────────────────────────────────────────────────────────

function PluginsTab() {
  const queryClient = useQueryClient()

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

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-4">
      {plugins.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-gray-500">
            <Plug size={40} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm">No plugins installed.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plugins.map((plugin: Plugin) => (
            <Card key={plugin.id}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center shrink-0">
                  {plugin.icon_url ? (
                    <img src={plugin.icon_url} alt={plugin.name} className="w-6 h-6" />
                  ) : (
                    <Plug size={18} className="text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white">{plugin.name}</h3>
                    {plugin.is_official && <Badge variant="info">Official</Badge>}
                    <Badge
                      variant={plugin.status === 'enabled' ? 'success' : plugin.status === 'error' ? 'error' : 'default'}
                      dot
                    >
                      {plugin.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    v{plugin.version} by {plugin.author}
                  </p>
                  {plugin.description && (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{plugin.description}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    {plugin.status === 'enabled' ? (
                      <Button
                        variant="outline"
                        size="xs"
                        icon={<XCircle size={12} />}
                        loading={disableMutation.isPending}
                        onClick={() => disableMutation.mutate(plugin.id)}
                      >
                        Disable
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        icon={<CheckCircle size={12} />}
                        loading={enableMutation.isPending}
                        onClick={() => enableMutation.mutate(plugin.id)}
                      >
                        Enable
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main AdminPage ─────────────────────────────────────────────────────────────

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Administration</h2>
        <p className="text-sm text-gray-400 mt-0.5">Manage users, permissions, audit logs, and plugins</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="-mb-px flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 border-b-2 px-4 pb-3 pt-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'profiles' && <ProfilesTab />}
        {activeTab === 'audit' && <AuditLogTable />}
        {activeTab === 'plugins' && <PluginsTab />}
      </div>
    </div>
  )
}
