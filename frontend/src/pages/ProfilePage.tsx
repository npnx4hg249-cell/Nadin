import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Key, Shield, User } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'At least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

type ChangePasswordForm = z.infer<typeof changePasswordSchema>

export default function ProfilePage() {
  const { user } = useAuthStore()
  const [show2faSetup, setShow2faSetup] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordForm>({ resolver: zodResolver(changePasswordSchema) })

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordForm) =>
      authApi.changePassword({ current_password: data.current_password, new_password: data.new_password, confirm_password: data.confirm_password }),
    onSuccess: () => { toast.success('Password changed'); reset() },
    onError: () => toast.error('Failed to change password'),
  })

  const setup2faMutation = useMutation({
    mutationFn: authApi.setup2fa,
    onSuccess: () => { setShow2faSetup(true); toast.success('Scan the QR code with your authenticator app') },
    onError: () => toast.error('Failed to start 2FA setup'),
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="mt-1 text-sm text-gray-400">Manage your account settings and security</p>
      </div>

      <Card>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white">
            <User className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">{user?.full_name || user?.email}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <div className="mt-2 flex gap-2">
              <Badge variant="info">{user?.role?.replace('_', ' ')}</Badge>
              {user?.is_2fa_enabled && <Badge variant="success">2FA Active</Badge>}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-gray-400" />
          <h2 className="font-semibold text-white">Change Password</h2>
        </div>
        <form onSubmit={handleSubmit((d) => changePasswordMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-300">Current Password</label>
            <Input type="password" {...register('current_password')} error={errors.current_password?.message} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">New Password</label>
            <Input type="password" {...register('new_password')} error={errors.new_password?.message} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">Confirm New Password</label>
            <Input type="password" {...register('confirm_password')} error={errors.confirm_password?.message} />
          </div>
          <Button type="submit" loading={changePasswordMutation.isPending}>
            Change Password
          </Button>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-gray-400" />
          <h2 className="font-semibold text-white">Two-Factor Authentication</h2>
        </div>
        {user?.is_2fa_enabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="success">Enabled</Badge>
              <span className="text-sm text-gray-400">Your account is protected with 2FA</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast('Contact an admin to disable 2FA')}>
              Disable 2FA
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Add an extra layer of security by enabling two-factor authentication.
            </p>
            {show2faSetup ? (
              <div className="rounded-lg bg-gray-800 p-4 text-center">
                <img
                  src="/api/v1/auth/2fa/qrcode"
                  alt="2FA QR Code"
                  className="mx-auto mb-3 rounded"
                />
                <p className="text-sm text-gray-400">
                  Scan this QR code with your authenticator app, then enter the code on the{' '}
                  <a href="/setup-2fa" className="text-blue-400 underline">setup page</a>.
                </p>
              </div>
            ) : (
              <Button onClick={() => setup2faMutation.mutate()} loading={setup2faMutation.isPending}>
                Enable 2FA
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
