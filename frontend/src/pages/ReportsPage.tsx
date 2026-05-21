import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { reportsApi } from '@/api/reports'
import { ReportCard } from '@/components/reports/ReportCard'
import { ReportEditor } from '@/components/reports/ReportEditor'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import type { Report } from '@/types'

export default function ReportsPage() {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Report | null | 'new'>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports', search],
    queryFn: () => reportsApi.list({ search }),
  })

  const reports = data?.items ?? []

  const filtered = search
    ? reports.filter(
        (r) =>
          r.title?.toLowerCase().includes(search.toLowerCase()) ||
          r.description?.toLowerCase().includes(search.toLowerCase()),
      )
    : reports

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="mt-1 text-sm text-gray-400">Create and manage your reports</p>
        </div>
        <Button onClick={() => setEditing('new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Report
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-16 text-center">
          <p className="text-gray-400">No reports found</p>
          <Button variant="ghost" className="mt-3" onClick={() => setEditing('new')}>
            Create your first report
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onEdit={() => setEditing(report)}
              onDeleted={() => refetch()}
            />
          ))}
        </div>
      )}

      {editing !== null && (
        <ReportEditor
          report={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refetch() }}
        />
      )}
    </div>
  )
}
