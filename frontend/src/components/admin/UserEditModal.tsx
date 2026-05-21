import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { usersApi } from '@/api/users'
import { adminApi } from '@/api/admin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { User } from '@/types'

const editSchema = z.object({
  username: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['admin', 'user', 'viewer']),
  is_active: z.boolean(),
  permission_profile_id: z.string().nullable().optional(),
})

const resetPasswordSchema = z.object({
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
})

type EditValues = z.infer<typeof editSchema>
type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

interface UserEditModalProps {
  user: User | null
  mode: 'edit' | 'reset-password' | null
  onClose: () => void
}

export function UserEditModal({ user, mode, onClose }: UserEditModalProps) {
  const queryClient = useQueryClient()

  const { data: profiles = [] } = useQuery({
    queryKey: ['permission-profiles'],
    queryFn: adminApi.listProfiles,
    enabled: mode === 'edit',
  })

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: user
      ? {
          username: user.username,
          role: user.role,
          is_active: user.is_active,
          permission_profile_id: user.permission_profile_id,
        }
      : undefined,
  })

  const resetForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const updateMutation = useMutation({
    mutationFn: (values: EditValues) => usersApi.update(user!.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated successfully')
      onClose()
    },
    onError: () => toast.error('Failed to update user'),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (values: ResetPasswordValues) =>
      usersApi.resetPassword(user!.id, { new_password: values.new_password }),
    onSuccess: () => {
      toast.success('Password reset successfully')
      onClose()
    },
    onError: () => toast.error('Failed to reset password'),
  })

  if (!user || !mode) return null

  if (mode === 'reset-password') {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title="Reset Password"
        description={`Set a new password for ${user.username}`}
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={resetPasswordMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="reset-password-form"
              variant="danger"
              loading={resetPasswordMutation.isPending}
            >
              Reset password
            </Button>
          </>
        }
      >
        <form
          id="reset-password-form"
          onSubmit={resetForm.handleSubmit((v) => resetPasswordMutation.mutate(v))}
          className="space-y-4"
        >
          <Input
            label="New password"
            type="password"
            required
            hint="Min 8 chars, one uppercase, one number"
            error={resetForm.formState.errors.new_password?.message}
            {...resetForm.register('new_password')}
          />
        </form>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit User"
      description={`Modify settings for ${user.username}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-user-form"
            loading={updateMutation.isPending}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form
        id="edit-user-form"
        onSubmit={editForm.handleSubmit((v) => updateMutation.mutate(v))}
        className="space-y-4"
      >
        <Input
          label="Full name"
          required
          error={editForm.formState.errors.username?.message}
          {...editForm.register('username')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Role <span className="text-red-400">*</span>
          </label>
          <select
            className="w-full rounded-md border border-gray-600 bg-gray-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            {...editForm.register('role')}
          >
            <option value="viewer">Viewer</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {profiles.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Permission profile
            </label>
            <select
              className="w-full rounded-md border border-gray-600 bg-gray-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              {...editForm.register('permission_profile_id')}
            >
              <option value="">No profile (use role defaults)</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_active"
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
            {...editForm.register('is_active')}
          />
          <label htmlFor="is_active" className="text-sm text-gray-300">
            Account active
          </label>
        </div>
      </form>
    </Modal>
  )
}
