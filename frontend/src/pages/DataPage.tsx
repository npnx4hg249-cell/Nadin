import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Database, Upload, RefreshCw } from 'lucide-react'
import { ingestApi } from '@/api/ingest'
import { DatasetCard } from '@/components/ingest/DatasetCard'
import { UploadModal } from '@/components/ingest/UploadModal'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { useT } from '@/i18n'

export function DataPage() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const t = useT()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => ingestApi.listDatasets({ limit: 100 }),
  })

  const datasets = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Database size={20} className="text-blue-400" />
            {t.data.title}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{t.data.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />}
            onClick={() => refetch()}
          >
            {t.common.refresh}
          </Button>
          <Button
            size="sm"
            icon={<Upload size={14} />}
            onClick={() => setUploadOpen(true)}
          >
            {t.data.uploadBtn}
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {total > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400">
            <span className="text-white font-semibold">{total}</span>{' '}
            {total === 1 ? t.data.dataset : t.data.datasets}
          </div>
          <div className="h-4 w-px bg-gray-700" />
          <div className="text-sm text-gray-400">
            <span className="text-emerald-400 font-semibold">
              {datasets.filter((d) => d.status === 'ready').length}
            </span>{' '}
            {t.data.ready}
          </div>
          {datasets.some((d) => d.status === 'error') && (
            <>
              <div className="h-4 w-px bg-gray-700" />
              <div className="text-sm text-gray-400">
                <span className="text-red-400 font-semibold">
                  {datasets.filter((d) => d.status === 'error').length}
                </span>{' '}
                {t.data.failed}
              </div>
            </>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <PageSpinner />
        </div>
      ) : datasets.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
            <Database size={28} className="text-gray-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-300">{t.data.noDataTitle}</h3>
            <p className="text-xs text-gray-500 mt-1">{t.data.noDataSub}</p>
          </div>
          <Button icon={<Upload size={14} />} onClick={() => setUploadOpen(true)}>
            {t.data.uploadBtn}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {datasets.map((dataset) => (
            <DatasetCard key={dataset.id} dataset={dataset} />
          ))}
        </div>
      )}

      <UploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  )
}
