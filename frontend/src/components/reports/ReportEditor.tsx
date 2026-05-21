import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { reportsApi } from '@/api/reports'
import { pluginsApi } from '@/api/plugins'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { Report } from '@/types'

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional().default(''),
  type: z.enum(['table', 'chart', 'mixed', 'custom']),
  plugin_id: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ReportEditorProps {
  isOpen: boolean
  onClose: () => void
  report?: Report | null
}

export function ReportEditor({ isOpen, onClose, report }: ReportEditorProps) {
  const queryClient = useQueryClient()
  const isEdit = !!report

  const { data: plugins = [] } = useQuery({
    queryKey: ['plugins'],
    queryFn: pluginsApi.list,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: report
      ? {
          title: report.title,
          description: report.description,
          type: report.type,
          plugin_id: report.plugin_id ?? undefined,
        }
      : {
          title: '',
          description: '',
          type: 'table',
          plugin_id: undefined,
        },
  })

  const createMutation = useMutation({
    mutationFn: reportsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Report created successfully')
      reset()
      onClose()
    },
    onError: () => toast.error('Failed to create report'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => reportsApi.update(report!.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Report updated successfully')
      onClose()
    },
    onError: () => toast.error('Failed to update report'),
  })

  const onSubmit = (values: FormValues) => {
    if (isEdit) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Report' : 'Create Report'}
      description={isEdit ? 'Update the report configuration.' : 'Set up a new report.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="report-editor-form"
            loading={isPending}
          >
            {isEdit ? 'Save changes' : 'Create report'}
          </Button>
        </>
      }
    >
      <form
        id="report-editor-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <Input
          label="Title"
          required
          placeholder="Monthly Revenue Report"
          error={errors.title?.message}
          {...register('title')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Description
          </label>
          <textarea
            className="w-full rounded-md border border-gray-600 bg-gray-800 text-white placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
            rows={3}
            placeholder="Describe what this report shows..."
            {...register('description')}
          />
          {errors.description && (
            <p className="mt-1.5 text-xs text-red-400">{errors.description.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Report type <span className="text-red-400">*</span>
          </label>
          <select
            className="w-full rounded-md border border-gray-600 bg-gray-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            {...register('type')}
          >
            <option value="table">Table</option>
            <option value="chart">Chart</option>
            <option value="mixed">Mixed (Table + Chart)</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {plugins.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Data source plugin
            </label>
            <select
              className="w-full rounded-md border border-gray-600 bg-gray-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              {...register('plugin_id')}
            >
              <option value="">None (manual data)</option>
              {plugins
                .filter((p) => p.status === 'enabled')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        )}
      </form>
    </Modal>
  )
}
