import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { MetricDef } from '@/api/engine'

const FUNCTIONS = [
  { value: 'sum', label: 'SUM' },
  { value: 'avg', label: 'AVG' },
  { value: 'min', label: 'MIN' },
  { value: 'max', label: 'MAX' },
  { value: 'count', label: 'COUNT' },
  { value: 'count_distinct', label: 'COUNT DISTINCT' },
  { value: 'stddev', label: 'STD DEV' },
  { value: 'median', label: 'MEDIAN' },
]

interface MetricBuilderProps {
  metrics: MetricDef[]
  availableColumns: string[]
  onChange: (metrics: MetricDef[]) => void
}

export function MetricBuilder({ metrics, availableColumns, onChange }: MetricBuilderProps) {
  const addMetric = (column?: string) => {
    onChange([
      ...metrics,
      { column: column ?? availableColumns[0] ?? '', function: 'sum', alias: '' },
    ])
  }

  const removeMetric = (index: number) => {
    onChange(metrics.filter((_, i) => i !== index))
  }

  const updateMetric = (index: number, patch: Partial<MetricDef>) => {
    onChange(metrics.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  const inputCls = cn(
    'block w-full rounded-md border border-gray-600 bg-gray-800 text-white text-xs',
    'px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
    'hover:border-gray-500 transition-colors',
  )

  return (
    <div className="space-y-2">
      {metrics.length === 0 && (
        <p className="text-xs text-gray-500 italic">No metrics added yet.</p>
      )}

      {metrics.map((metric, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={metric.column}
            onChange={(e) => updateMetric(i, { column: e.target.value })}
            className={cn(inputCls, 'flex-1 min-w-0')}
          >
            {availableColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
            {!availableColumns.includes(metric.column) && metric.column && (
              <option value={metric.column}>{metric.column}</option>
            )}
          </select>

          <select
            value={metric.function}
            onChange={(e) => updateMetric(i, { function: e.target.value })}
            className={cn(inputCls, 'w-36 shrink-0')}
          >
            {FUNCTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={metric.alias ?? ''}
            placeholder="alias (optional)"
            onChange={(e) => updateMetric(i, { alias: e.target.value || undefined })}
            className={cn(inputCls, 'w-32 shrink-0')}
          />

          <button
            onClick={() => removeMetric(i)}
            className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
            aria-label="Remove metric"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <Button
        size="sm"
        variant="outline"
        icon={<Plus size={12} />}
        onClick={() => addMetric()}
      >
        Add Metric
      </Button>
    </div>
  )
}
