import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart2, Trash2, FileText, Rows, Columns, HardDrive, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { ingestApi, type Dataset } from '@/api/ingest'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmModal } from '@/components/ui/Modal'
import type { BadgeVariant } from '@/types'

interface DatasetCardProps {
  dataset: Dataset
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const statusVariant: Record<Dataset['status'], BadgeVariant> = {
  ready: 'success',
  processing: 'warning',
  error: 'error',
  pending: 'default',
}

export function DatasetCard({ dataset }: DatasetCardProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => ingestApi.deleteDataset(dataset.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] })
      toast.success('Dataset deleted')
      setConfirmDelete(false)
    },
    onError: () => toast.error('Failed to delete dataset'),
  })

  return (
    <>
      <Card className="flex flex-col gap-3 h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{dataset.name}</h3>
            {dataset.description && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{dataset.description}</p>
            )}
          </div>
          <Badge variant={statusVariant[dataset.status]} dot className="shrink-0">
            {dataset.status}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <FileText size={12} className="shrink-0" />
          <span className="truncate">{dataset.original_filename}</span>
          <span className="uppercase text-gray-600 shrink-0">.{dataset.original_format}</span>
        </div>

        {dataset.error_message && (
          <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">
            {dataset.error_message}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 mt-auto">
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-gray-900/60 px-2 py-1.5">
            <Rows size={12} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-300">
              {dataset.row_count !== null ? dataset.row_count.toLocaleString() : '—'}
            </span>
            <span className="text-[10px] text-gray-600">rows</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-gray-900/60 px-2 py-1.5">
            <Columns size={12} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-300">
              {dataset.column_count ?? '—'}
            </span>
            <span className="text-[10px] text-gray-600">cols</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-gray-900/60 px-2 py-1.5">
            <HardDrive size={12} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-300">
              {formatBytes(dataset.file_size_bytes)}
            </span>
            <span className="text-[10px] text-gray-600">size</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Calendar size={11} />
          <span>{formatDate(dataset.created_at)}</span>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-gray-700">
          <Button
            size="sm"
            icon={<BarChart2 size={14} />}
            className="flex-1"
            disabled={dataset.status !== 'ready'}
            onClick={() => navigate(`/analysis?dataset=${dataset.id}`)}
          >
            Analyse
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 size={14} />}
            onClick={() => setConfirmDelete(true)}
          />
        </div>
      </Card>

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete dataset"
        message={`Are you sure you want to delete "${dataset.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </>
  )
}
