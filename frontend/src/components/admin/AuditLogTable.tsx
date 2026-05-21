import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { Table, Pagination } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/utils'
import type { AuditLogEntry, AuditAction } from '@/types'

const actionGroups: Record<string, AuditAction[]> = {
  'Auth': ['user.login', 'user.logout', 'user.login_failed'],
  'Users': ['user.created', 'user.updated', 'user.deleted', 'user.2fa_enabled', 'user.2fa_disabled', 'user.password_changed'],
  'Reports': ['report.created', 'report.updated', 'report.deleted', 'report.run'],
  'Plugins': ['plugin.enabled', 'plugin.disabled', 'plugin.configured'],
  'Admin': ['admin.settings_changed'],
}

function getActionVariant(action: AuditAction): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (action.includes('deleted') || action.includes('failed') || action.includes('disabled')) return 'error'
  if (action.includes('login') && !action.includes('failed')) return 'success'
  if (action.includes('created') || action.includes('enabled')) return 'success'
  if (action.includes('updated') || action.includes('configured') || action.includes('changed')) return 'info'
  return 'default'
}

export function AuditLogTable() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', page, search, actionFilter, fromDate, toDate],
    queryFn: () =>
      adminApi.getAuditLog({
        page,
        per_page: 20,
        actor_id: search || undefined,
        action: (actionFilter as AuditAction) || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      }),
  })

  const columns = [
    {
      key: 'created_at',
      header: 'Time',
      width: '160px',
      render: (entry: AuditLogEntry) => (
        <span className="text-gray-400 font-mono text-xs">{formatDateTime(entry.created_at)}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: '200px',
      render: (entry: AuditLogEntry) => (
        <Badge variant={getActionVariant(entry.action)}>
          {entry.action}
        </Badge>
      ),
    },
    {
      key: 'actor_email',
      header: 'Actor',
      render: (entry: AuditLogEntry) => (
        <span className="text-gray-300">{entry.actor_email}</span>
      ),
    },
    {
      key: 'ip_address',
      header: 'IP address',
      width: '130px',
      render: (entry: AuditLogEntry) => (
        <span className="font-mono text-xs text-gray-400">{entry.ip_address}</span>
      ),
    },
    {
      key: 'target_type',
      header: 'Target',
      width: '120px',
      render: (entry: AuditLogEntry) => (
        <span className="text-gray-500 text-xs">
          {entry.target_type ? `${entry.target_type}` : '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search by actor email..."
            leftIcon={<Search size={14} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select
          className="rounded-md border border-gray-600 bg-gray-800 text-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
        >
          <option value="">All actions</option>
          {Object.entries(actionGroups).map(([group, actions]) => (
            <optgroup key={group} label={group}>
              {actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          type="date"
          className="rounded-md border border-gray-600 bg-gray-800 text-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
          title="From date"
        />
        <input
          type="date"
          className="rounded-md border border-gray-600 bg-gray-800 text-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); setPage(1) }}
          title="To date"
        />
        {(search || actionFilter || fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(''); setActionFilter(''); setFromDate(''); setToDate(''); setPage(1) }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(e) => e.id}
        loading={isLoading}
        emptyMessage="No audit log entries found."
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
    </div>
  )
}
