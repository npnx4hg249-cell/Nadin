// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  email: string
  username: string
  role: 'super_admin' | 'admin' | 'editor' | 'viewer'
  is_active: boolean
  is_verified: boolean
  totp_enabled: boolean
  force_totp: boolean
  permission_profile_id: number | null
  created_at: string
  updated_at: string
  last_login: string | null
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
}

export interface TwoFactorVerifyRequest {
  code: string
  email: string
}

export interface TwoFactorSetupResponse {
  secret: string
  qr_uri: string
  backup_codes: string[]
}

export interface TokenRefreshResponse {
  access_token: string
  token_type: 'bearer'
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export type ReportStatus = 'draft' | 'published' | 'archived'
export type ReportType = 'table' | 'chart' | 'mixed' | 'custom'

export interface Report {
  id: string
  title: string
  description: string
  type: ReportType
  status: ReportStatus
  owner_id: string
  owner_name: string
  plugin_id: string | null
  config: Record<string, unknown>
  last_run_at: string | null
  created_at: string
  updated_at: string
}

export interface ReportCreatePayload {
  title: string
  description: string
  type: ReportType
  plugin_id?: string
  config?: Record<string, unknown>
}

export interface ReportUpdatePayload extends Partial<ReportCreatePayload> {
  status?: ReportStatus
}

export interface ReportRunResult {
  report_id: string
  ran_at: string
  duration_ms: number
  rows: number
  data: unknown[]
  chart_data?: ChartSeries[]
}

export interface ChartSeries {
  name: string
  data: { label: string; value: number }[]
}

// ─── Plugins ─────────────────────────────────────────────────────────────────

export type PluginStatus = 'enabled' | 'disabled' | 'error'

export interface Plugin {
  id: string
  name: string
  slug: string
  description: string
  version: string
  author: string
  status: PluginStatus
  is_official: boolean
  config_schema: Record<string, unknown> | null
  config: Record<string, unknown>
  icon_url: string | null
  homepage_url: string | null
  created_at: string
  updated_at: string
}

export interface PluginConfigPayload {
  config: Record<string, unknown>
}

// ─── Admin — Users ────────────────────────────────────────────────────────────

export interface AdminUserUpdatePayload {
  username?: string
  role?: User['role']
  is_active?: boolean
  permission_profile_id?: number | null
  force_totp?: boolean
}

export interface PasswordResetPayload {
  new_password: string
}

// ─── Admin — Permission Profiles ─────────────────────────────────────────────

export type Permission =
  | 'reports.view'
  | 'reports.create'
  | 'reports.edit'
  | 'reports.delete'
  | 'reports.run'
  | 'reports.export'
  | 'plugins.view'
  | 'plugins.install'
  | 'plugins.configure'
  | 'admin.users'
  | 'admin.audit'
  | 'admin.settings'

export interface PermissionProfile {
  id: string
  name: string
  description: string
  permissions: Permission[]
  user_count: number
  created_at: string
  updated_at: string
}

export interface PermissionProfilePayload {
  name: string
  description: string
  permissions: Permission[]
}

// ─── Admin — Audit Log ────────────────────────────────────────────────────────

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.login_failed'
  | 'user.2fa_enabled'
  | 'user.2fa_disabled'
  | 'user.password_changed'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'report.created'
  | 'report.updated'
  | 'report.deleted'
  | 'report.run'
  | 'plugin.enabled'
  | 'plugin.disabled'
  | 'plugin.configured'
  | 'admin.settings_changed'

export interface AuditLogEntry {
  id: string
  action: AuditAction
  actor_id: string
  actor_email: string
  target_id: string | null
  target_type: string | null
  ip_address: string
  user_agent: string
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface PaginationParams {
  page?: number
  per_page?: number
  search?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  user_count: number
  active_user_count: number
  report_count: number
  plugin_count: number
  recent_report_runs: number
  storage_used_mb: number
}

export interface ActivityItem {
  id: string
  action: AuditAction
  actor_email: string
  description: string
  timestamp: string
  severity: 'info' | 'warning' | 'error'
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
  confirm_password: string
}

export interface UpdateProfilePayload {
  username?: string
  email?: string
}

// ─── UI ──────────────────────────────────────────────────────────────────────

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'

// ─── API Error ────────────────────────────────────────────────────────────────

export interface ApiError {
  detail: string
  code?: string
  field?: string
}

export interface ApiValidationError {
  detail: Array<{
    loc: string[]
    msg: string
    type: string
  }>
}
