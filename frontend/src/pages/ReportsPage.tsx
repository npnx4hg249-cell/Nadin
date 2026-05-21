import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Play, BarChart2, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { reportsApi } from '@/api/reports'
import { ReportCard } from '@/components/reports/ReportCard'
import { ReportEditor } from '@/components/reports/ReportEditor'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatDateTime } from '@/lib/utils'
import type { Report, ReportRunResult } from '@/types'

const chartTooltipStyle = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#f3f4f6',
  fontSize: 12,
}

export default function ReportsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<Report | null>(null)
  const [deletingReport, setDeletingReport] = useState<Report | null>(null)
  const [viewingReport, setViewingReport] = useState<Report | null>(null)
  const [runResult, setRunResult] = useState<ReportRunResult | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['reports', page, search, statusFilter],
    queryFn: () =>
      reportsApi.list({
        page,
        per_page: 12,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Report deleted')
      setDeletingReport(null)
    },
    onError: () => toast.error('Failed to delete report'),
  })

  const handleRun = async (report: Report) => {
    setRunningId(report.id)
    try {
      const result = await reportsApi.run(report.id)
      setRunResult(result)
      setViewingReport(report)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast.success(`Report ran in ${result.duration_ms}ms — ${result.rows} rows returned`)
    } catch {
      toast.error('Failed to run report')
    } finally {
      setRunningId(null)
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    if (!viewingReport) return
    try {
      const blob = await reportsApi.export(viewingReport.id, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${viewingReport.title}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    }
  }

  const openEditor = (report?: Report) => {
    setEditingReport(report ?? null)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditingReport(null)
  }

  const renderRunResult = (result: ReportRunResult) => {
    if (result.chart_data && result.chart_data.length > 0) {
      const series = result.chart_data[0]
      return (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={series.data} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Bar dataKey="value" name={series.name} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    }

    const tableData = result.data as Record<string, unknown>[]
    if (tableData.length === 0) return <p className="text-gray-400 text-sm">No data returned.</p>

    const keys = Object.keys(tableData[0])
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {keys.map((k) => (
                <th key={k} className="px-4 py-2 text-left text-xs text-gray-400 uppercase tracking-wider">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {tableData.slice(0, 20).map((row, i) => (
              <tr key={i} className="hover:bg-gray-700/30">
                {keys.map((k) => (
                  <td key={k} className="px-4 py-2 text-gray-300">{String(row[k] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Reports</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {data?.total ?? 0} report{data?.total !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => openEditor()}>
          New report
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search reports..."
            leftIcon={<Search size={14} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select
          className="rounded-md border border-gray-600 bg-gray-800 text-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        {(search || statusFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter(''); setPage(1) }}>
            Clear
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <PageSpinner />
      ) : data?.items.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <BarChart2 size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300">No reports yet</h3>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              Create your first report to start generating insights.
            </p>
            <Button onClick={() => openEditor()}>Create first report</Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data?.items.map((report) => (
              <div key={report.id} className="relative">
                {runningId === report.id && (
                  <div className="absolute inset-0 bg-gray-900/60 rounded-xl flex items-center justify-center z-10">
                    <div className="flex items-center gap-2 text-sm text-blue-400">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Running...
                    </div>
                  </div>
                )}
                <ReportCard
                  report={report}
                  onRun={handleRun}
                  onEdit={openEditor}
                  onDelete={setDeletingReport}
                  onView={(r) => { setViewingReport(r); setRunResult(null) }}
                />
              </div>
            ))}
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-gray-400">Page {page} of {data.pages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Report editor */}
      <ReportEditor isOpen={editorOpen} onClose={closeEditor} report={editingReport} />

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!deletingReport}
        onClose={() => setDeletingReport(null)}
        onConfirm={() => deletingReport && deleteMutation.mutate(deletingReport.id)}
        title="Delete report"
        message={`Are you sure you want to delete "${deletingReport?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />

      {/* Report viewer */}
      {viewingReport && (
        <Modal
          isOpen={!!viewingReport}
          onClose={() => { setViewingReport(null); setRunResult(null) }}
          title={viewingReport.title}
          description={viewingReport.description || undefined}
          size="xl"
          footer={
            <div className="flex items-center gap-2 w-full">
              {runResult && (
                <>
                  <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={() => handleExport('csv')}>
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={() => handleExport('json')}>
                    JSON
                  </Button>
                  <div className="flex-1" />
                </>
              )}
              <Button
                icon={<Play size={14} />}
                loading={runningId === viewingReport.id}
                onClick={() => handleRun(viewingReport)}
              >
                Run now
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={viewingReport.status === 'published' ? 'success' : viewingReport.status === 'draft' ? 'warning' : 'default'}>
                {viewingReport.status}
              </Badge>
              <Badge variant="info">{viewingReport.type}</Badge>
              <span className="text-xs text-gray-500">Last run: {formatDateTime(viewingReport.last_run_at)}</span>
            </div>

            {runResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>Ran at: {formatDateTime(runResult.ran_at)}</span>
                  <span>Duration: {runResult.duration_ms}ms</span>
                  <span>Rows: {runResult.rows}</span>
                </div>
                {renderRunResult(runResult)}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500">
                <Play size={32} className="mx-auto mb-3 text-gray-600" />
                <p className="text-sm">Click "Run now" to execute this report and view results.</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
