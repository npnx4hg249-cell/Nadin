import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Shield, Activity, Plug, Plus, Search, Trash2, Settings,
  CheckCircle, XCircle, Database, Cpu, Save, RefreshCw,
  type LucideIcon,
} from 'lucide-react'
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
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import type { User, PermissionProfile, Plugin, LlmSettings } from '@/types'

type Tab = 'users' | 'profiles' | 'audit' | 'plugins' | 'database' | 'system'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'profiles', label: 'Permission Profiles', icon: Shield },
  { id: 'audit', label: 'Audit Log', icon: Activity },
  { id: 'plugins', label: 'Plugins', icon: Plug },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'system', label: 'LLM Settings', icon: Cpu },
]

// ─── Create User Modal ──────────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email('Valid email required'),
  username: z.string().min(3, 'Min 3 characters').max(64).regex(/^[a-zA-Z0-9_\-]+$/, 'Letters, numbers, _ and - only'),
  password: z
    .string()
    .min(8, 'Min 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  role: z.enum(['super_admin', 'admin', 'editor', 'viewer']),
  is_active: z.boolean(),
})

type CreateUserValues = z.infer<typeof createUserSchema>

function CreateUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'viewer', is_active: true },
  })

  const mutation = useMutation({
    mutationFn: (v: CreateUserValues) => usersApi.create(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created successfully')
      form.reset()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to create user')
    },
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New User"
      description="Add a new user account to the system"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" form="create-user-form" loading={mutation.isPending}>
            Create user
          </Button>
        </>
      }
    >
      <form
        id="create-user-form"
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        className="space-y-4"
      >
        <Input
          label="Email address"
          type="email"
          required
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Input
          label="Username"
          required
          placeholder="e.g. jsmith"
          hint="Letters, numbers, _ and - only"
          error={form.formState.errors.username?.message}
          {...form.register('username')}
        />
        <Input
          label="Initial password"
          type="password"
          required
          hint="Min 8 chars, one uppercase, one number"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Role <span className="text-red-400">*</span>
          </label>
          <select
            className="w-full rounded-md border border-gray-600 bg-gray-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            {...form.register('role')}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="cu_is_active"
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand-600 focus:ring-brand-500"
            {...form.register('is_active')}
          />
          <label htmlFor="cu_is_active" className="text-sm text-gray-300">Account active immediately</label>
        </div>
      </form>
    </Modal>
  )
}

// ─── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editMode, setEditMode] = useState<'edit' | 'reset-password' | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const PER_PAGE = 15

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersApi.list({ page, per_page: PER_PAGE, search: search || undefined }),
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

  // Compute pages from total
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))

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
        <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
          New user
        </Button>
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

      {total > PER_PAGE && (
        <Pagination
          page={page}
          pages={pages}
          total={total}
          perPage={PER_PAGE}
          onPageChange={setPage}
        />
      )}

      <CreateUserModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />

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
    mutationFn: (id: number) => adminApi.deleteProfile(id),
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
                    className="p-1.5 rounded text-gray-500 hover:text-brand-400 hover:bg-gray-700 transition-colors"
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plugins'] }); toast.success('Plugin enabled') },
    onError: () => toast.error('Failed to enable plugin'),
  })

  const disableMutation = useMutation({
    mutationFn: (id: string) => pluginsApi.disable(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plugins'] }); toast.success('Plugin disabled') },
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
                  {plugin.icon_url
                    ? <img src={plugin.icon_url} alt={plugin.name} className="w-6 h-6" />
                    : <Plug size={18} className="text-gray-400" />}
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
                  <p className="text-xs text-gray-400 mt-0.5">v{plugin.version} by {plugin.author}</p>
                  {plugin.description && (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{plugin.description}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    {plugin.status === 'enabled' ? (
                      <Button variant="outline" size="xs" icon={<XCircle size={12} />}
                        loading={disableMutation.isPending}
                        onClick={() => disableMutation.mutate(plugin.id)}>
                        Disable
                      </Button>
                    ) : (
                      <Button variant="outline" size="xs" icon={<CheckCircle size={12} />}
                        loading={enableMutation.isPending}
                        onClick={() => enableMutation.mutate(plugin.id)}>
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

// ─── Database Tab ───────────────────────────────────────────────────────────────

function DatabaseTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-db-stats'],
    queryFn: adminApi.getDbStats,
    staleTime: 30_000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">PostgreSQL</h3>
          {data && (
            <p className="text-sm text-gray-400 mt-0.5">
              {data.host} / {data.database} · total {data.db_size}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />}
          onClick={() => refetch()}
        >
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Table</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Rows</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total size</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Index size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {(data?.tables ?? []).map((t) => (
                <tr key={t.table_name} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-300">{t.table_name}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{t.row_count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{t.total_size}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{t.index_size}</td>
                </tr>
              ))}
              {(data?.tables ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No tables found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── System / LLM Settings Tab ─────────────────────────────────────────────────

const llmSchema = z.object({
  ollama_url: z.string().url('Must be a valid URL'),
  ollama_model: z.string().min(1, 'Model name is required'),
  llm_enabled: z.boolean(),
})

type LlmFormValues = z.infer<typeof llmSchema>

function SystemTab() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-llm-settings'],
    queryFn: adminApi.getLlmSettings,
  })

  const form = useForm<LlmFormValues>({
    resolver: zodResolver(llmSchema),
    values: data
      ? { ollama_url: data.ollama_url, ollama_model: data.ollama_model, llm_enabled: data.llm_enabled }
      : undefined,
  })

  const mutation = useMutation({
    mutationFn: (values: LlmFormValues) => adminApi.updateLlmSettings(values),
    onSuccess: (updated: LlmSettings) => {
      queryClient.setQueryData(['admin-llm-settings'], updated)
      toast.success('LLM settings saved')
    },
    onError: () => toast.error('Failed to save LLM settings'),
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h3 className="text-base font-semibold text-white">Ollama / LLM Configuration</h3>
        <p className="text-sm text-gray-400 mt-1">
          Configure the local LLM used for natural-language SQL generation and data translation.
          Changes take effect immediately — no restart required.
        </p>
      </div>

      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-700 bg-gray-800/40">
          <input
            type="checkbox"
            id="llm_enabled"
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand-600 focus:ring-brand-500"
            {...form.register('llm_enabled')}
          />
          <div>
            <label htmlFor="llm_enabled" className="text-sm font-medium text-gray-200">
              LLM features enabled
            </label>
            <p className="text-xs text-gray-500">
              Disabling hides NL→SQL mode and data translation
            </p>
          </div>
        </div>

        <Input
          label="Ollama URL"
          required
          placeholder="http://ollama:11434"
          hint="Internal Docker service URL"
          error={form.formState.errors.ollama_url?.message}
          {...form.register('ollama_url')}
        />

        <Input
          label="Model name"
          required
          placeholder="qwen2.5-coder:7b-instruct"
          hint="Must be pulled in Ollama first"
          error={form.formState.errors.ollama_model?.message}
          {...form.register('ollama_model')}
        />

        <div className="pt-2">
          <Button
            type="submit"
            icon={<Save size={15} />}
            loading={mutation.isPending}
          >
            Save settings
          </Button>
        </div>
      </form>

      <Card className="border-gray-700">
        <p className="text-xs font-medium text-gray-400 mb-2">Common models</p>
        <div className="space-y-1">
          {[
            { name: 'qwen2.5-coder:7b-instruct', desc: 'Default — good SQL generation, 4.5 GB' },
            { name: 'sqlcoder:7b', desc: 'Specialised SQL model, 4.1 GB' },
            { name: 'llama3.1:8b', desc: 'General purpose, 4.7 GB' },
            { name: 'mistral:7b', desc: 'Fast general model, 4.1 GB' },
          ].map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => form.setValue('ollama_model', m.name)}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-700 transition-colors group"
            >
              <span className="text-sm font-mono text-brand-400 group-hover:text-brand-300">{m.name}</span>
              <span className="text-xs text-gray-500 ml-2">{m.desc}</span>
            </button>
          ))}
        </div>
      </Card>
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
        <p className="text-sm text-gray-400 mt-0.5">Manage users, permissions, database, and system settings</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="-mb-px flex gap-1 flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 border-b-2 px-4 pb-3 pt-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'border-brand-500 text-brand-400'
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
        {activeTab === 'database' && <DatabaseTab />}
        {activeTab === 'system' && <SystemTab />}
      </div>
    </div>
  )
}
