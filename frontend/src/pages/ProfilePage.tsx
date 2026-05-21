import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Key, Shield, User, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { formatDateTime } from '@/lib/utils'

const profileSchema = z.object({
  username: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
})

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Required'),
    new_password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/[0-9]/, 'Must include a number'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

const disable2faSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code'),
})

type ProfileValues = z.infer<typeof profileSchema>
type ChangePasswordValues = z.infer<typeof changePasswordSchema>
type Disable2faValues = z.infer<typeof disable2faSchema>

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const navigate = useNavigate()
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [disable2faOpen, setDisable2faOpen] = useState(false)

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      username: user?.username ?? '',
      email: user?.email ?? '',
    },
  })

  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  })

  const disable2faForm = useForm<Disable2faValues>({
    resolver: zodResolver(disable2faSchema),
  })

  const updateProfileMutation = useMutation({
    mutationFn: (values: ProfileValues) => authApi.updateProfile(values),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser)
      toast.success('Profile updated')
    },
    onError: () => toast.error('Failed to update profile'),
  })

  const changePasswordMutation = useMutation({
    mutationFn: (values: ChangePasswordValues) =>
      authApi.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
        confirm_password: values.confirm_password,
      }),
    onSuccess: () => {
      toast.success('Password changed successfully')
      passwordForm.reset()
    },
    onError: () => toast.error('Incorrect current password or server error'),
  })

  const disable2faMutation = useMutation({
    mutationFn: (code: string) => authApi.disable2fa(code),
    onSuccess: () => {
      updateUser({ totp_enabled: false })
      toast.success('Two-factor authentication disabled')
      setDisable2faOpen(false)
      disable2faForm.reset()
    },
    onError: () => toast.error('Invalid code. Please try again.'),
  })

  const passwordValue = passwordForm.watch('new_password') ?? ''
  const passwordStrength = {
    length: passwordValue.length >= 8,
    uppercase: /[A-Z]/.test(passwordValue),
    number: /[0-9]/.test(passwordValue),
    special: /[^A-Za-z0-9]/.test(passwordValue),
  }
  const strengthScore = Object.values(passwordStrength).filter(Boolean).length

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile info card */}
      <Card>
        <CardHeader title="Profile information" subtitle="Update your name and email address" />

        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-700">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
            {user?.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white">{user?.username}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={user?.role === 'admin' ? 'info' : 'default'} className="capitalize">
                {user?.role}
              </Badge>
              <Badge variant={user?.is_active ? 'success' : 'error'} dot>
                {user?.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {user?.totp_enabled && <Badge variant="success">2FA enabled</Badge>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-xs text-gray-500">
          <div>
            <span className="block text-gray-400 mb-0.5">Last login</span>
            {formatDateTime(user?.last_login)}
          </div>
          <div>
            <span className="block text-gray-400 mb-0.5">Account created</span>
            {formatDateTime(user?.created_at)}
          </div>
        </div>

        <form
          onSubmit={profileForm.handleSubmit((v) => updateProfileMutation.mutate(v))}
          className="space-y-4"
        >
          <Input
            label="Full name"
            required
            error={profileForm.formState.errors.username?.message}
            leftIcon={<User size={16} />}
            {...profileForm.register('username')}
          />
          <Input
            label="Email address"
            type="email"
            required
            error={profileForm.formState.errors.email?.message}
            {...profileForm.register('email')}
          />
          <Button type="submit" loading={updateProfileMutation.isPending}>
            Save profile
          </Button>
        </form>
      </Card>

      {/* Change password card */}
      <Card>
        <CardHeader
          title="Change password"
          subtitle="Choose a strong password to keep your account secure"
          actions={<Key size={16} className="text-gray-500" />}
        />

        <form
          onSubmit={passwordForm.handleSubmit((v) => changePasswordMutation.mutate(v))}
          className="space-y-4"
        >
          <Input
            label="Current password"
            type={showCurrentPw ? 'text' : 'password'}
            required
            error={passwordForm.formState.errors.current_password?.message}
            rightElement={
              <button
                type="button"
                onClick={() => setShowCurrentPw((v) => !v)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            {...passwordForm.register('current_password')}
          />

          <div className="space-y-2">
            <Input
              label="New password"
              type={showNewPw ? 'text' : 'password'}
              required
              error={passwordForm.formState.errors.new_password?.message}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              {...passwordForm.register('new_password')}
            />

            {passwordValue && (
              <div className="space-y-2">
                <div className="flex gap-1 h-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-colors ${
                        i <= strengthScore
                          ? strengthScore <= 1
                            ? 'bg-red-500'
                            : strengthScore <= 2
                            ? 'bg-amber-500'
                            : strengthScore <= 3
                            ? 'bg-yellow-400'
                            : 'bg-emerald-500'
                          : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(passwordStrength).map(([key, met]) => (
                    <div
                      key={key}
                      className={`flex items-center gap-1.5 text-xs ${met ? 'text-emerald-400' : 'text-gray-500'}`}
                    >
                      {met ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                      {key === 'length'
                        ? '8+ characters'
                        : key === 'uppercase'
                        ? 'Uppercase letter'
                        : key === 'number'
                        ? 'Number'
                        : 'Special character'}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Input
            label="Confirm new password"
            type="password"
            required
            error={passwordForm.formState.errors.confirm_password?.message}
            {...passwordForm.register('confirm_password')}
          />

          <Button type="submit" loading={changePasswordMutation.isPending}>
            Update password
          </Button>
        </form>
      </Card>

      {/* 2FA card */}
      <Card>
        <CardHeader
          title="Two-factor authentication"
          subtitle="Add an extra layer of security to your account"
          actions={<Shield size={16} className="text-gray-500" />}
        />

        {user?.totp_enabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-900/20 border border-emerald-800/50">
              <CheckCircle size={18} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-400">2FA is active</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Your account is protected with an authenticator app.
                </p>
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={() => setDisable2faOpen(true)}>
              Disable 2FA
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-900/20 border border-amber-800/50">
              <AlertCircle size={18} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-400">2FA is not enabled</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Enable two-factor authentication to better protect your account.
                </p>
              </div>
            </div>
            <Button icon={<Shield size={16} />} onClick={() => navigate('/setup-2fa')}>
              Enable 2FA
            </Button>
          </div>
        )}
      </Card>

      {/* Disable 2FA modal */}
      <Modal
        isOpen={disable2faOpen}
        onClose={() => { setDisable2faOpen(false); disable2faForm.reset() }}
        title="Disable two-factor authentication"
        description="Enter your current authenticator code to confirm."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDisable2faOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              type="submit"
              form="disable-2fa-form"
              loading={disable2faMutation.isPending}
            >
              Disable 2FA
            </Button>
          </>
        }
      >
        <form
          id="disable-2fa-form"
          onSubmit={disable2faForm.handleSubmit((v) => disable2faMutation.mutate(v.code))}
        >
          <Input
            label="Authenticator code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            required
            error={disable2faForm.formState.errors.code?.message}
            {...disable2faForm.register('code')}
          />
        </form>
      </Modal>
    </div>
  )
}
