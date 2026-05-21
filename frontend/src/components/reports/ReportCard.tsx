import { MoreVertical, Play, Edit2, Trash2, BarChart2, Table2, LayoutDashboard, Code } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Report, ReportStatus, ReportType, BadgeVariant } from '@/types'

interface ReportCardProps {
  report: Report
  onRun: (report: Report) => void
  onEdit: (report: Report) => void
  onDelete: (report: Report) => void
  onView: (report: Report) => void
}

const statusVariant: Record<ReportStatus, BadgeVariant> = {
  draft: 'warning',
  published: 'success',
  archived: 'default',
}

const typeIcons: Record<ReportType, React.FC<{ size?: number }>> = {
  chart: BarChart2,
  table: Table2,
  mixed: LayoutDashboard,
  custom: Code,
}

export function ReportCard({ report, onRun, onEdit, onDelete, onView }: ReportCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const TypeIcon = typeIcons[report.type]

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onView(report)}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-md bg-blue-900/40 border border-blue-800 flex items-center justify-center text-blue-400 shrink-0">
              <TypeIcon size={14} />
            </div>
            <Badge variant={statusVariant[report.status]}>{report.status}</Badge>
          </div>
          <h3 className="font-semibold text-white text-sm group-hover:text-blue-300 transition-colors truncate">
            {report.title}
          </h3>
          {report.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{report.description}</p>
          )}
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 z-20 w-40 bg-gray-750 border border-gray-600 rounded-lg shadow-xl overflow-hidden animate-slide-in">
                <button
                  onClick={() => { onRun(report); setMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <Play size={14} /> Run report
                </button>
                <button
                  onClick={() => { onEdit(report); setMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button
                  onClick={() => { onDelete(report); setMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs text-gray-500">
        <span>By {report.owner_name}</span>
        {report.last_run_at ? (
          <span>Run {formatRelativeTime(report.last_run_at)}</span>
        ) : (
          <span>Never run</span>
        )}
      </div>
    </div>
  )
}
