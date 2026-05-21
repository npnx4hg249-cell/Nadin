import apiClient from './client'
import type {
  LoginCredentials,
  LoginResponse,
  TwoFactorVerifyRequest,
  TwoFactorSetupResponse,
  User,
  ChangePasswordPayload,
  UpdateProfilePayload,
} from '@/types'

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', credentials)
    return data
  },

  verify2fa: async (payload: TwoFactorVerifyRequest): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/2fa/verify', payload)
    return data
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout')
  },

  refreshToken: async (): Promise<{ access_token: string }> => {
    const { data } = await apiClient.post<{ access_token: string }>('/auth/refresh')
    return data
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me')
    return data
  },

  setup2fa: async (): Promise<TwoFactorSetupResponse> => {
    const { data } = await apiClient.post<TwoFactorSetupResponse>('/auth/2fa/setup')
    return data
  },

  confirm2faSetup: async (code: string): Promise<{ backup_codes: string[] }> => {
    const { data } = await apiClient.post<{ backup_codes: string[] }>(
      '/auth/2fa/confirm',
      { code },
    )
    return data
  },

  disable2fa: async (code: string): Promise<void> => {
    await apiClient.post('/auth/2fa/disable', { code })
  },

  changePassword: async (payload: ChangePasswordPayload): Promise<void> => {
    await apiClient.post('/auth/change-password', payload)
  },

  updateProfile: async (payload: UpdateProfilePayload): Promise<User> => {
    const { data } = await apiClient.patch<User>('/auth/me', payload)
    return data
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email })
  },

  resetPassword: async (token: string, new_password: string): Promise<void> => {
    await apiClient.post('/auth/reset-password', { token, new_password })
  },
}
