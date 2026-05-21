import { Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ColumnInfo } from '@/api/ingest'

interface SchemaExplorerProps {
  columns: ColumnInfo[]
  onAddMetric?: (column: string) => void
  onAddGroupBy?: (column: string) => void
}

const dtypeColor: Record<string, string> = {
  Int8: 'text-blue-400 bg-blue-900/30',
  Int16: 'text-blue-400 bg-blue-900/30',
  Int32: 'text-blue-400 bg-blue-900/30',
  Int64: 'text-blue-400 bg-blue-900/30',
  UInt8: 'text-blue-400 bg-blue-900/30',
  UInt16: 'text-blue-400 bg-blue-900/30',
  UInt32: 'text-blue-400 bg-blue-900/30',
  UInt64: 'text-blue-400 bg-blue-900/30',
  Float32: 'text-cyan-400 bg-cyan-900/30',
  Float64: 'text-cyan-400 bg-cyan-900/30',
  Utf8: 'text-amber-400 bg-amber-900/30',
  String: 'text-amber-400 bg-amber-900/30',
  Boolean: 'text-purple-400 bg-purple-900/30',
  Date: 'text-emerald-400 bg-emerald-900/30',
  Datetime: 'text-emerald-400 bg-emerald-900/30',
}

function getDtypeColor(dtype: string): string {
  for (const [key, cls] of Object.entries(dtypeColor)) {
    if (dtype.startsWith(key)) return cls
  }
  return 'text-gray-400 bg-gray-700/50'
}

function shortDtype(dtype: string): string {
  if (dtype.startsWith('Int') || dtype.startsWith('UInt')) return 'int'
  if (dtype.startsWith('Float')) return 'float'
  if (dtype === 'Utf8' || dtype === 'String') return 'str'
  if (dtype === 'Boolean') return 'bool'
  if (dtype.startsWith('Date')) return 'date'
  return dtype.slice(0, 6)
}

export function SchemaExplorer({ columns, onAddMetric, onAddGroupBy }: SchemaExplorerProps) {
  if (!columns.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500 text-xs gap-1">
        <Tag size={16} className="text-gray-600" />
        <span>No columns</span>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {columns.map((col) => (
        <div
          key={col.name}
          className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-800 cursor-default"
        >
          <span
            className={cn(
              'shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
              getDtypeColor(col.dtype),
            )}
          >
            {shortDtype(col.dtype)}
          </span>
          <span className="flex-1 text-xs text-gray-300 truncate font-mono" title={col.name}>
            {col.name}
          </span>
          <div className="hidden group-hover:flex items-center gap-1 shrink-0">
            {onAddMetric && (
              <button
                onClick={() => onAddMetric(col.name)}
                className="text-[10px] text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-900/30 hover:bg-blue-900/50 transition-colors"
                title="Add as metric"
              >
                +metric
              </button>
            )}
            {onAddGroupBy && (
              <button
                onClick={() => onAddGroupBy(col.name)}
                className="text-[10px] text-purple-400 hover:text-purple-300 px-1.5 py-0.5 rounded bg-purple-900/30 hover:bg-purple-900/50 transition-colors"
                title="Add to group by"
              >
                +group
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
