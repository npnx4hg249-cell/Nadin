import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  BarChart2,
  Play,
  Download,
  ChevronDown,
  Table,
  X,
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
import { ingestApi } from '@/api/ingest'
import { analysisApi } from '@/api/analysis'
import { outputApi } from '@/api/output'
import { SchemaExplorer } from '@/components/analysis/SchemaExplorer'
import { MetricBuilder } from '@/components/analysis/MetricBuilder'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import type { MetricDef } from '@/api/engine'
import type { AnalysisResult } from '@/api/analysis'

const CHART_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa']

const tooltipStyle = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#f3f4f6',
  fontSize: 12,
}

type ChartType = 'bar' | 'line' | 'pie' | 'scatter'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ResultsTable({ result }: { result: AnalysisResult }) {
  return (
    <div className="overflow-auto max-h-64 rounded-lg border border-gray-700">
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
            <tr
              key={ri}
              className={ri % 2 === 0 ? 'bg-gray-900/40' : 'bg-transparent'}
            >
              {row.map((cell, ci) => (
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

  // Build recharts data: array of {col0: val, col1: val, ...}
  const chartData = result.rows.map((row) => {
    const obj: Record<string, unknown> = {}
    result.columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj
  })

  const xKey = result.columns[0]
  const yKeys = result.columns.slice(1)

  if (chartType === 'pie' && yKeys.length > 0) {
    const yKey = yKeys[0]
    return (
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey={yKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={({ name, percent }) =>
              `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'scatter' && yKeys.length > 0) {
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
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
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

export function AnalysisPage() {
  const [searchParams] = useSearchParams()
  const initialDatasetId = searchParams.get('dataset')
    ? Number(searchParams.get('dataset'))
    : null

  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(initialDatasetId)
  const [metrics, setMetrics] = useState<MetricDef[]>([])
  const [groupBy, setGroupBy] = useState<string[]>([])
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [activeTab, setActiveTab] = useState<'table' | 'chart'>('table')

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
    setGroupBy((prev) => prev.includes(col) ? prev : [...prev, col])
  }, [])

  const removeGroupBy = (col: string) => {
    setGroupBy((prev) => prev.filter((c) => c !== col))
  }

  const runMutation = useMutation({
    mutationFn: () =>
      analysisApi.runAnalysis({
        dataset_id: selectedDatasetId!,
        metrics,
        group_by: groupBy.length ? groupBy : undefined,
      }),
    onSuccess: (data) => {
      setResult(data)
      setActiveTab('table')
    },
    onError: () => toast.error('Analysis failed'),
  })

  const csvMutation = useMutation({
    mutationFn: () => outputApi.exportCsv(result!.columns, result!.rows),
    onSuccess: (blob) => downloadBlob(blob, 'analysis_result.csv'),
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
        { type: 'heading', content: selectedDataset?.name ?? 'Analysis Report' },
        { type: 'table', columns: result!.columns, rows: result!.rows },
      ]),
    onSuccess: (blob) => downloadBlob(blob, 'analysis_report.pdf'),
    onError: () => toast.error('PDF export failed'),
  })

  const canRun = selectedDatasetId !== null && metrics.length > 0

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div className="w-64 shrink-0 flex flex-col border-r border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart2 size={15} className="text-blue-400" />
            Analysis Workspace
          </h2>
        </div>

        {/* Dataset selector */}
        <div className="p-3 border-b border-gray-800">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Dataset</label>
          {loadingDatasets ? (
            <div className="h-8 bg-gray-800 rounded animate-pulse" />
          ) : (
            <div className="relative">
              <select
                value={selectedDatasetId ?? ''}
                onChange={(e) => {
                  const id = Number(e.target.value) || null
                  setSelectedDatasetId(id)
                  setMetrics([])
                  setGroupBy([])
                  setResult(null)
                }}
                className={cn(
                  'w-full rounded-md border border-gray-600 bg-gray-800 text-white text-xs',
                  'pl-2 pr-6 py-1.5 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500',
                )}
              >
                <option value="">Select a dataset…</option>
                {readyDatasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          )}
        </div>

        {/* Schema explorer */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-medium text-gray-400 mb-2">Columns</p>
          {selectedDataset ? (
            <SchemaExplorer
              columns={columns}
              onAddMetric={addMetricColumn}
              onAddGroupBy={addGroupByColumn}
            />
          ) : (
            <p className="text-xs text-gray-600 italic">Select a dataset to see columns</p>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Metric builder */}
        <div className="p-4 border-b border-gray-800 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Metrics
              </p>
            </div>
            <MetricBuilder
              metrics={metrics}
              availableColumns={columnNames}
              onChange={setMetrics}
            />
          </div>

          {/* Group by */}
          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Group By
            </p>
            <div className="flex flex-wrap gap-1.5">
              {groupBy.map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-900/40 text-purple-300 border border-purple-800/50"
                >
                  {col}
                  <button onClick={() => removeGroupBy(col)} className="hover:text-purple-100">
                    <X size={10} />
                  </button>
                </span>
              ))}
              {groupBy.length === 0 && (
                <span className="text-xs text-gray-600 italic">
                  Click +group on a column to group by it
                </span>
              )}
            </div>
          </div>

          <Button
            icon={<Play size={14} />}
            onClick={() => runMutation.mutate()}
            loading={runMutation.isPending}
            disabled={!canRun}
          >
            Run Analysis
          </Button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
          {runMutation.isPending && (
            <div className="flex items-center justify-center flex-1">
              <PageSpinner />
            </div>
          )}

          {result && !runMutation.isPending && (
            <>
              {/* Tab bar + export */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab('table')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                      activeTab === 'table'
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-400 hover:text-white',
                    )}
                  >
                    <Table size={12} />
                    Table
                    <span className="text-gray-500">({result.row_count})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('chart')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                      activeTab === 'chart'
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-400 hover:text-white',
                    )}
                  >
                    <BarChart2 size={12} />
                    Chart
                  </button>
                </div>

                {/* Chart type selector (only when on chart tab) */}
                {activeTab === 'chart' && (
                  <div className="relative">
                    <select
                      value={chartType}
                      onChange={(e) => setChartType(e.target.value as ChartType)}
                      className={cn(
                        'rounded-md border border-gray-600 bg-gray-800 text-white text-xs',
                        'pl-2 pr-6 py-1.5 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500',
                      )}
                    >
                      <option value="bar">Bar</option>
                      <option value="line">Line</option>
                      <option value="pie">Pie</option>
                      <option value="scatter">Scatter</option>
                    </select>
                    <ChevronDown
                      size={12}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </div>
                )}

                {/* Export buttons */}
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Download size={12} />}
                    loading={csvMutation.isPending}
                    onClick={() => csvMutation.mutate()}
                  >
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Download size={12} />}
                    loading={pdfMutation.isPending}
                    onClick={() => pdfMutation.mutate()}
                  >
                    PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Download size={12} />}
                    loading={grafanaMutation.isPending}
                    onClick={() => grafanaMutation.mutate()}
                  >
                    Grafana
                  </Button>
                </div>
              </div>

              {/* Table / Chart */}
              {activeTab === 'table' ? (
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
                <p className="text-sm font-medium text-gray-400">No results yet</p>
                <p className="text-xs text-gray-600 mt-1">
                  Select a dataset, add metrics, then click Run Analysis
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
