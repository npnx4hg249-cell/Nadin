import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart2,
  Play,
  Download,
  ChevronDown,
  Table,
  X,
  Sparkles,
  Code2,
  Sliders,
  Bookmark,
  Plus,
  CheckCircle2,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useT } from '@/i18n'
import { ingestApi } from '@/api/ingest'
import { analysisApi } from '@/api/analysis'
import { outputApi } from '@/api/output'
import { llmApi } from '@/api/llm'
import { insightsApi } from '@/api/insights'
import { SchemaExplorer } from '@/components/analysis/SchemaExplorer'
import { MetricBuilder } from '@/components/analysis/MetricBuilder'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import type { MetricDef } from '@/api/engine'
import type { AnalysisResult } from '@/api/analysis'

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa']

const tooltipStyle = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#f3f4f6',
  fontSize: 12,
}

type QueryMode = 'metric_builder' | 'natural_language' | 'raw_sql'
type ResultTab = 'table' | 'chart'
type ChartType = 'bar' | 'line' | 'pie' | 'scatter'

const QUERY_MODES: { id: QueryMode; icon: React.ReactNode }[] = [
  { id: 'metric_builder', icon: <Sliders size={13} /> },
  { id: 'natural_language', icon: <Sparkles size={13} /> },
  { id: 'raw_sql', icon: <Code2 size={13} /> },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function buildSchemaContext(columns: { name: string; dtype: string }[]): string {
  return columns.map((c) => `  ${c.name} ${c.dtype}`).join('\n')
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResultsTable({ result }: { result: AnalysisResult }) {
  return (
    <div className="overflow-auto max-h-72 rounded-lg border border-gray-700">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-800 z-10">
          <tr>
            {result.columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-semibold text-gray-300 border-b border-gray-700 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-gray-900/40' : 'bg-transparent'}>
              {(row as unknown[]).map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-1.5 text-gray-300 border-b border-gray-800/50 whitespace-nowrap"
                >
                  {cell === null || cell === undefined ? (
                    <span className="text-gray-600 italic">null</span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResultChart({ result, chartType }: { result: AnalysisResult; chartType: ChartType }) {
  if (result.columns.length < 2 || result.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        Need at least 2 columns and 1 row to render a chart.
      </div>
    )
  }

  const chartData = result.rows.map((row) => {
    const obj: Record<string, unknown> = {}
    result.columns.forEach((col, i) => { obj[col] = (row as unknown[])[i] })
    return obj
  })

  const xKey = result.columns[0]
  const yKeys = result.columns.slice(1)

  if (chartType === 'pie' && yKeys.length > 0) {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={chartData} dataKey={yKeys[0]} nameKey={xKey} cx="50%" cy="50%" outerRadius={90}
            label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}>
            {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey={xKey} stroke="#6b7280" tick={{ fontSize: 11 }} />
          <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={chartData} name={yKeys[0]} fill={CHART_COLORS[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey={xKey} stroke="#6b7280" tick={{ fontSize: 11 }} />
          <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {yKeys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey={xKey} stroke="#6b7280" tick={{ fontSize: 11 }} />
        <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {yKeys.map((key, i) => (
          <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Save Insight Modal ────────────────────────────────────────────────────────

interface SaveInsightModalProps {
  isOpen: boolean
  result: AnalysisResult
  datasetId: number
  queryMode: QueryMode
  sqlQuery?: string
  chartType: ChartType
  onClose: () => void
  onSaved: (insightId: number) => void
}

function SaveInsightModal({
  isOpen,
  result,
  datasetId,
  queryMode,
  sqlQuery,
  chartType,
  onClose,
  onSaved,
}: SaveInsightModalProps) {
  const t = useT()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      insightsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        dataset_id: datasetId,
        query_mode: queryMode,
        sql_query: sqlQuery,
        columns: result.columns,
        rows: result.rows,
        row_count: result.row_count,
        chart_type: chartType,
      }),
    onSuccess: (insight) => {
      toast.success(`Insight "${insight.name}" saved`)
      onSaved(insight.id)
      setName('')
      setDescription('')
    },
    onError: () => toast.error('Failed to save insight'),
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bookmark size={15} className="text-purple-400" />
            {t.insight.saveTitle}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.insight.namePlaceholder}
              className="w-full rounded-md border border-gray-600 bg-gray-800 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t.insight.descPlaceholder}
              className="w-full rounded-md border border-gray-600 bg-gray-800 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 resize-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              className="flex-1"
              icon={<Bookmark size={13} />}
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!name.trim()}
            >
              {t.insight.saveBtn}
            </Button>
            <Button variant="ghost" onClick={onClose} className="flex-1">
              {t.common.cancel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add to Report/Dashboard Panel ────────────────────────────────────────────

interface AddToTargetsProps {
  insightId: number
  onClose: () => void
}

function AddToTargetsPanel({ insightId, onClose }: AddToTargetsProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const [selectedReports, setSelectedReports] = useState<Set<number>>(new Set())
  const [selectedDashboards, setSelectedDashboards] = useState<Set<number>>(new Set())

  const { data: reportsData, isLoading: loadingReports } = useQuery({
    queryKey: ['reports-list-add'],
    queryFn: async () => {
      const { default: apiClient } = await import('@/api/client')
      const { data } = await apiClient.get('/reports', { params: { limit: 100 } })
      return data
    },
  })

  const { data: dashboardsData, isLoading: loadingDashboards } = useQuery({
    queryKey: ['dashboards-list-add'],
    queryFn: async () => {
      const { default: apiClient } = await import('@/api/client')
      const { data } = await apiClient.get('/dashboards', { params: { limit: 100 } })
      return data
    },
  })

  const addMutation = useMutation({
    mutationFn: () =>
      insightsApi.addTo(insightId, {
        report_ids: selectedReports.size > 0 ? [...selectedReports] : undefined,
        dashboard_ids: selectedDashboards.size > 0 ? [...selectedDashboards] : undefined,
      }),
    onSuccess: () => {
      toast.success('Insight added to selected destinations')
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      onClose()
    },
    onError: () => toast.error('Failed to add insight to targets'),
  })

  const reports = reportsData?.items ?? []
  const dashboards = dashboardsData?.items ?? []
  const nothingSelected = selectedReports.size === 0 && selectedDashboards.size === 0

  function toggleReport(id: number) {
    setSelectedReports((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleDashboard(id: number) {
    setSelectedDashboards((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus size={15} className="text-blue-400" />
            {t.insight.addTitle}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Reports */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText size={12} /> {t.insight.reportsLabel}
            </p>
            {loadingReports ? (
              <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 size={12} className="animate-spin" /> {t.common.loading}</div>
            ) : reports.length === 0 ? (
              <p className="text-xs text-gray-600 italic">{t.insight.noReports}</p>
            ) : (
              <div className="space-y-1">
                {reports.map((r: { id: number; name: string }) => (
                  <button
                    key={r.id}
                    onClick={() => toggleReport(r.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
                      selectedReports.has(r.id)
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-600/40'
                        : 'bg-gray-800/60 text-gray-300 border border-transparent hover:border-gray-600',
                    )}
                  >
                    {selectedReports.has(r.id)
                      ? <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full border border-gray-600 shrink-0" />}
                    <span className="truncate">{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dashboards */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <LayoutDashboard size={12} /> {t.insight.dashboardsLabel}
            </p>
            {loadingDashboards ? (
              <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 size={12} className="animate-spin" /> {t.common.loading}</div>
            ) : dashboards.length === 0 ? (
              <p className="text-xs text-gray-600 italic">{t.insight.noDashboards}</p>
            ) : (
              <div className="space-y-1">
                {dashboards.map((d: { id: number; name: string }) => (
                  <button
                    key={d.id}
                    onClick={() => toggleDashboard(d.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
                      selectedDashboards.has(d.id)
                        ? 'bg-purple-600/20 text-purple-300 border border-purple-600/40'
                        : 'bg-gray-800/60 text-gray-300 border border-transparent hover:border-gray-600',
                    )}
                  >
                    {selectedDashboards.has(d.id)
                      ? <CheckCircle2 size={14} className="text-purple-400 shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full border border-gray-600 shrink-0" />}
                    <span className="truncate">{d.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-800 flex items-center gap-2">
          <Button
            className="flex-1"
            icon={<Plus size={13} />}
            onClick={() => addMutation.mutate()}
            loading={addMutation.isPending}
            disabled={nothingSelected}
          >
            {t.insight.addBtn}
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">
            {t.common.cancel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function AnalysisPage() {
  const t = useT()
  const [searchParams] = useSearchParams()
  const initialDatasetId = searchParams.get('dataset') ? Number(searchParams.get('dataset')) : null

  // Dataset + query state
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(initialDatasetId)
  const [queryMode, setQueryMode] = useState<QueryMode>('metric_builder')

  // Metric builder state
  const [metrics, setMetrics] = useState<MetricDef[]>([])
  const [groupBy, setGroupBy] = useState<string[]>([])

  // Natural language state
  const [nlQuestion, setNlQuestion] = useState('')
  const [generatedSql, setGeneratedSql] = useState('')
  const [nlStatus, setNlStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle')

  // Raw SQL state
  const [rawSql, setRawSql] = useState('')

  // Results state
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [lastSql, setLastSql] = useState<string | undefined>(undefined)
  const [resultTab, setResultTab] = useState<ResultTab>('table')
  const [chartType, setChartType] = useState<ChartType>('bar')

  // Modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [addToModalInsightId, setAddToModalInsightId] = useState<number | null>(null)
  const [lastSavedInsightId, setLastSavedInsightId] = useState<number | null>(null)

  // Dataset list
  const { data: datasetsData, isLoading: loadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => ingestApi.listDatasets({ limit: 100 }),
  })

  const readyDatasets = (datasetsData?.items ?? []).filter((d) => d.status === 'ready')
  const selectedDataset = readyDatasets.find((d) => d.id === selectedDatasetId) ?? null
  const columns = selectedDataset?.schema_info?.columns ?? []
  const columnNames = columns.map((c) => c.name)

  const addMetricColumn = useCallback((col: string) => {
    setMetrics((prev) => [...prev, { column: col, function: 'sum' }])
  }, [])

  const addGroupByColumn = useCallback((col: string) => {
    setGroupBy((prev) => (prev.includes(col) ? prev : [...prev, col]))
  }, [])

  // ─── NL → SQL generation ──────────────────────────────────────────────────

  const generateSql = async () => {
    if (!nlQuestion.trim() || !selectedDatasetId) return
    setNlStatus('generating')
    setGeneratedSql('')
    try {
      const schemaContext = columns.length > 0 ? `TABLE: dataset\nCOLUMNS:\n${buildSchemaContext(columns)}` : undefined
      const res = await llmApi.nlToSql({
        question: nlQuestion,
        dataset_id: selectedDatasetId,
        schema_context: schemaContext,
      })
      setGeneratedSql(res.sql)
      setNlStatus('ready')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'LLM unavailable'
      toast.error(`SQL generation failed: ${msg}`)
      setNlStatus('error')
    }
  }

  // ─── Run analysis ─────────────────────────────────────────────────────────

  const runMutation = useMutation({
    mutationFn: async () => {
      if (queryMode === 'metric_builder') {
        return analysisApi.runAnalysis({
          dataset_id: selectedDatasetId!,
          metrics,
          group_by: groupBy.length ? groupBy : undefined,
        })
      }
      // NL or Raw SQL — both send raw SQL via engine query endpoint
      const sql = queryMode === 'natural_language' ? generatedSql : rawSql
      const { data } = await import('@/api/client').then(({ default: apiClient }) =>
        apiClient.post<AnalysisResult>('/engine/query', {
          dataset_id: selectedDatasetId,
          sql,
        }),
      )
      return data
    },
    onSuccess: (data) => {
      setResult(data)
      setResultTab('table')
      setLastSavedInsightId(null)
      const sql = queryMode === 'natural_language' ? generatedSql : queryMode === 'raw_sql' ? rawSql : undefined
      setLastSql(sql)
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Analysis failed')
    },
  })

  // ─── Export ───────────────────────────────────────────────────────────────

  const csvMutation = useMutation({
    mutationFn: () => outputApi.exportCsv(result!.columns, result!.rows),
    onSuccess: (blob) => downloadBlob(blob, 'insight_result.csv'),
    onError: () => toast.error('CSV export failed'),
  })

  const grafanaMutation = useMutation({
    mutationFn: () =>
      outputApi.generateGrafana([
        {
          title: selectedDataset?.name ?? 'Analysis',
          type: 'graph',
          metrics,
          group_by: groupBy.length ? groupBy : undefined,
        },
      ]),
    onSuccess: (blob) => downloadBlob(blob, 'grafana_dashboard.json'),
    onError: () => toast.error('Grafana export failed'),
  })

  const pdfMutation = useMutation({
    mutationFn: () =>
      outputApi.generatePdf([
        { type: 'heading', content: selectedDataset?.name ?? 'Insight Report' },
        { type: 'table', columns: result!.columns, rows: result!.rows },
      ]),
    onSuccess: (blob) => downloadBlob(blob, 'insight_report.pdf'),
    onError: () => toast.error('PDF export failed'),
  })

  // ─── Can run? ─────────────────────────────────────────────────────────────

  const canRun = (() => {
    if (!selectedDatasetId) return false
    if (queryMode === 'metric_builder') return metrics.length > 0
    if (queryMode === 'natural_language') return nlStatus === 'ready' && generatedSql.trim().length > 0
    return rawSql.trim().length > 0
  })()

  // ─── Reset on dataset change ──────────────────────────────────────────────

  const handleDatasetChange = (id: number | null) => {
    setSelectedDatasetId(id)
    setMetrics([])
    setGroupBy([])
    setNlQuestion('')
    setGeneratedSql('')
    setNlStatus('idle')
    setRawSql('')
    setResult(null)
    setLastSavedInsightId(null)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div className="w-64 shrink-0 flex flex-col border-r border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart2 size={15} className="text-blue-400" />
            {t.analysis.title}
          </h2>
        </div>

        {/* Dataset selector */}
        <div className="p-3 border-b border-gray-800">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">{t.analysis.datasetLabel}</label>
          {loadingDatasets ? (
            <div className="h-8 bg-gray-800 rounded animate-pulse" />
          ) : (
            <div className="relative">
              <select
                value={selectedDatasetId ?? ''}
                onChange={(e) => handleDatasetChange(Number(e.target.value) || null)}
                className={cn(
                  'w-full rounded-md border border-gray-600 bg-gray-800 text-white text-xs',
                  'pl-2 pr-6 py-1.5 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500',
                )}
              >
                <option value="">{t.analysis.datasetPlaceholder}</option>
                {readyDatasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Schema explorer */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-medium text-gray-400 mb-2">{t.analysis.columnsLabel}</p>
          {selectedDataset ? (
            <SchemaExplorer
              columns={columns}
              onAddMetric={addMetricColumn}
              onAddGroupBy={addGroupByColumn}
            />
          ) : (
            <p className="text-xs text-gray-600 italic">{t.analysis.columnsEmpty}</p>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Query mode tabs + builder */}
        <div className="p-4 border-b border-gray-800 space-y-4">
          {/* Mode tabs */}
          <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1 w-fit">
            {QUERY_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  setQueryMode(mode.id)
                  setResult(null)
                  setLastSavedInsightId(null)
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  queryMode === mode.id
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white',
                )}
              >
                {mode.icon}
                {t.analysis.queryModes[mode.id]}
              </button>
            ))}
          </div>

          {/* ── Metric Builder ── */}
          {queryMode === 'metric_builder' && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">{t.analysis.metricsLabel}</p>
                <MetricBuilder metrics={metrics} availableColumns={columnNames} onChange={setMetrics} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">{t.analysis.groupByLabel}</p>
                <div className="flex flex-wrap gap-1.5">
                  {groupBy.map((col) => (
                    <span key={col} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-900/40 text-purple-300 border border-purple-800/50">
                      {col}
                      <button onClick={() => setGroupBy((p) => p.filter((c) => c !== col))} className="hover:text-purple-100"><X size={10} /></button>
                    </span>
                  ))}
                  {groupBy.length === 0 && <span className="text-xs text-gray-600 italic">{t.analysis.groupByEmpty}</span>}
                </div>
              </div>
            </div>
          )}

          {/* ── Natural Language ── */}
          {queryMode === 'natural_language' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  {t.analysis.questionLabel}
                </label>
                <textarea
                  value={nlQuestion}
                  onChange={(e) => {
                    setNlQuestion(e.target.value)
                    setNlStatus('idle')
                    setGeneratedSql('')
                  }}
                  rows={3}
                  placeholder={t.analysis.questionPlaceholder}
                  className="w-full rounded-md border border-gray-600 bg-gray-800 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={
                    nlStatus === 'generating'
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Sparkles size={13} />
                  }
                  onClick={generateSql}
                  disabled={!nlQuestion.trim() || !selectedDatasetId || nlStatus === 'generating'}
                >
                  {nlStatus === 'generating' ? t.analysis.generating : t.analysis.generateSql}
                </Button>
                {nlStatus === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <AlertCircle size={12} /> {t.analysis.llmUnavailable}
                  </span>
                )}
              </div>

              {generatedSql && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1">{t.analysis.generatedSqlLabel}</p>
                  <textarea
                    value={generatedSql}
                    onChange={(e) => setGeneratedSql(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-gray-600 bg-gray-800/80 text-emerald-300 text-xs font-mono px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Raw SQL ── */}
          {queryMode === 'raw_sql' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t.analysis.sqlLabel}</label>
              <textarea
                value={rawSql}
                onChange={(e) => setRawSql(e.target.value)}
                rows={5}
                placeholder={`SELECT column, SUM(value) AS total\nFROM dataset\nGROUP BY column\nORDER BY total DESC`}
                className="w-full rounded-md border border-gray-600 bg-gray-800/80 text-emerald-300 text-xs font-mono px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 resize-none"
                spellCheck={false}
              />
              <p className="text-xs text-gray-600 mt-1">{t.analysis.sqlNote} <code className="text-gray-400">dataset</code>. {t.analysis.selectOnly}</p>
            </div>
          )}

          <Button
            icon={<Play size={14} />}
            onClick={() => runMutation.mutate()}
            loading={runMutation.isPending}
            disabled={!canRun}
          >
            {t.analysis.runBtn}
          </Button>
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
          {runMutation.isPending && (
            <div className="flex items-center justify-center flex-1">
              <PageSpinner />
            </div>
          )}

          {result && !runMutation.isPending && (
            <>
              {/* Tab bar + controls */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Result view tabs */}
                <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setResultTab('table')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                      resultTab === 'table' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white',
                    )}
                  >
                    <Table size={12} />
                    {t.analysis.tableTab}
                    <span className="text-gray-500">({result.row_count})</span>
                  </button>
                  <button
                    onClick={() => setResultTab('chart')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                      resultTab === 'chart' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white',
                    )}
                  >
                    <BarChart2 size={12} />
                    {t.analysis.chartTab}
                  </button>
                </div>

                {/* Chart type (only visible on chart tab) */}
                {resultTab === 'chart' && (
                  <div className="relative">
                    <select
                      value={chartType}
                      onChange={(e) => setChartType(e.target.value as ChartType)}
                      className="rounded-md border border-gray-600 bg-gray-800 text-white text-xs pl-2 pr-6 py-1.5 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="bar">Bar</option>
                      <option value="line">Line</option>
                      <option value="pie">Pie</option>
                      <option value="scatter">Scatter</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                )}

                {/* Right controls */}
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  {/* Save as Insight */}
                  {lastSavedInsightId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Plus size={12} />}
                      onClick={() => setAddToModalInsightId(lastSavedInsightId)}
                      className="border-purple-700/50 text-purple-300 hover:border-purple-600"
                    >
                      {t.analysis.addToTarget}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Bookmark size={12} />}
                      onClick={() => setSaveModalOpen(true)}
                      className="border-purple-700/50 text-purple-300 hover:border-purple-600"
                    >
                      {t.analysis.saveInsight}
                    </Button>
                  )}

                  {/* Exports */}
                  <Button size="sm" variant="outline" icon={<Download size={12} />} loading={csvMutation.isPending} onClick={() => csvMutation.mutate()}>
                    CSV
                  </Button>
                  <Button size="sm" variant="outline" icon={<Download size={12} />} loading={pdfMutation.isPending} onClick={() => pdfMutation.mutate()}>
                    PDF
                  </Button>
                  <Button size="sm" variant="outline" icon={<Download size={12} />} loading={grafanaMutation.isPending} onClick={() => grafanaMutation.mutate()}>
                    Grafana
                  </Button>
                </div>
              </div>

              {/* Table / Chart */}
              {resultTab === 'table' ? (
                <ResultsTable result={result} />
              ) : (
                <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-4">
                  <ResultChart result={result} chartType={chartType} />
                </div>
              )}
            </>
          )}

          {!result && !runMutation.isPending && (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-3">
              <BarChart2 size={32} className="text-gray-700" />
              <div>
                <p className="text-sm font-medium text-gray-400">{t.analysis.noResultsTitle}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {queryMode === 'metric_builder' && t.analysis.noResults.metric_builder}
                  {queryMode === 'natural_language' && t.analysis.noResults.natural_language}
                  {queryMode === 'raw_sql' && t.analysis.noResults.raw_sql}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save as Insight modal */}
      {saveModalOpen && result && selectedDatasetId && (
        <SaveInsightModal
          isOpen={saveModalOpen}
          result={result}
          datasetId={selectedDatasetId}
          queryMode={queryMode}
          sqlQuery={lastSql}
          chartType={chartType}
          onClose={() => setSaveModalOpen(false)}
          onSaved={(id) => {
            setLastSavedInsightId(id)
            setSaveModalOpen(false)
          }}
        />
      )}

      {/* Add to Report/Dashboard modal */}
      {addToModalInsightId !== null && (
        <AddToTargetsPanel
          insightId={addToModalInsightId}
          onClose={() => setAddToModalInsightId(null)}
        />
      )}
    </div>
  )
}
