import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminApi } from '@/api/admin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { PermissionProfile, Permission } from '@/types'

const PERMISSION_GROUPS: { label: string; permissions: { value: Permission; label: string }[] }[] = [
  {
    label: 'Reports',
    permissions: [
      { value: 'reports.view', label: 'View reports' },
      { value: 'reports.create', label: 'Create reports' },
      { value: 'reports.edit', label: 'Edit reports' },
      { value: 'reports.delete', label: 'Delete reports' },
      { value: 'reports.run', label: 'Run reports' },
      { value: 'reports.export', label: 'Export reports' },
    ],
  },
  {
    label: 'Plugins',
    permissions: [
      { value: 'plugins.view', label: 'View plugins' },
      { value: 'plugins.install', label: 'Install plugins' },
      { value: 'plugins.configure', label: 'Configure plugins' },
    ],
  },
  {
    label: 'Administration',
    permissions: [
      { value: 'admin.users', label: 'Manage users' },
      { value: 'admin.audit', label: 'View audit log' },
      { value: 'admin.settings', label: 'Modify settings' },
    ],
  },
]

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(64),
  description: z.string().max(200).optional().default(''),
  permissions: z.array(z.string()),
})

type FormValues = z.infer<typeof schema>

interface PermissionProfileFormProps {
  isOpen: boolean
  onClose: () => void
  profile?: PermissionProfile | null
}

export function PermissionProfileForm({ isOpen, onClose, profile }: PermissionProfileFormProps) {
  const queryClient = useQueryClient()
  const isEdit = !!profile

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: profile
      ? {
          name: profile.name,
          description: profile.description,
          permissions: profile.permissions,
        }
      : { name: '', description: '', permissions: [] },
  })

  const selectedPermissions = watch('permissions') as Permission[]

  const togglePermission = (perm: Permission) => {
    const current = selectedPermissions
    if (current.includes(perm)) {
      setValue('permissions', current.filter((p) => p !== perm))
    } else {
      setValue('permissions', [...current, perm])
    }
  }

  const toggleGroup = (permissions: Permission[]) => {
    const allSelected = permissions.every((p) => selectedPermissions.includes(p))
    if (allSelected) {
      setValue('permissions', selectedPermissions.filter((p) => !permissions.includes(p)))
    } else {
      const newPerms = [...new Set([...selectedPermissions, ...permissions])]
      setValue('permissions', newPerms)
    }
  }

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      adminApi.createProfile({
        name: values.name,
        description: values.description || '',
        permissions: values.permissions as Permission[],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-profiles'] })
      toast.success('Profile created')
      reset()
      onClose()
    },
    onError: () => toast.error('Failed to create profile'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      adminApi.updateProfile(profile!.id, {
        name: values.name,
        description: values.description || '',
        permissions: values.permissions as Permission[],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-profiles'] })
      toast.success('Profile updated')
      onClose()
    },
    onError: () => toast.error('Failed to update profile'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (values: FormValues) => {
    if (isEdit) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Permission Profile' : 'Create Permission Profile'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="profile-form"
            loading={isPending}
          >
            {isEdit ? 'Save changes' : 'Create profile'}
          </Button>
        </>
      }
    >
      <form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label="Profile name"
          required
          placeholder="Power Users"
          error={errors.name?.message}
          {...register('name')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
          <textarea
            className="w-full rounded-md border border-gray-600 bg-gray-800 text-white placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
            rows={2}
            placeholder="Describe what this profile grants..."
            {...register('description')}
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-300 mb-3">Permissions</p>
          <div className="space-y-4">
            {PERMISSION_GROUPS.map((group) => {
              const groupPerms = group.permissions.map((p) => p.value)
              const allSelected = groupPerms.every((p) => selectedPermissions.includes(p))
              const someSelected = groupPerms.some((p) => selectedPermissions.includes(p))

              return (
                <div key={group.label} className="border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupPerms)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-750 hover:bg-gray-700 transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-gray-200">{group.label}</span>
                    <div className="flex items-center gap-2">
                      {someSelected && !allSelected && (
                        <span className="text-xs text-gray-400">partial</span>
                      )}
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          allSelected
                            ? 'bg-blue-600 border-blue-600'
                            : someSelected
                            ? 'bg-blue-900 border-blue-600'
                            : 'border-gray-500'
                        }`}
                      >
                        {(allSelected || someSelected) && (
                          <div className="w-2 h-0.5 bg-white rounded" />
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="px-4 py-3 grid grid-cols-2 gap-2">
                    {group.permissions.map((perm) => (
                      <label
                        key={perm.value}
                        className="flex items-center gap-2.5 cursor-pointer group/perm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(perm.value)}
                          onChange={() => togglePermission(perm.value)}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-gray-400 group-hover/perm:text-gray-200 transition-colors">
                          {perm.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-xs text-gray-500">
          {selectedPermissions.length} permission{selectedPermissions.length !== 1 ? 's' : ''} selected
        </p>
      </form>
    </Modal>
  )
}
