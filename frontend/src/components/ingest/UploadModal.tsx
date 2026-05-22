import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, File as FileIcon, Languages } from 'lucide-react'
import toast from 'react-hot-toast'
import { ingestApi } from '@/api/ingest'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div className="relative shrink-0">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className={cn('w-9 h-5 rounded-full border transition-colors', checked ? 'bg-blue-600 border-blue-600' : 'bg-gray-700 border-gray-600')} />
        <div className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform', checked && 'translate-x-4')} />
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  )
}

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const t = useT()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [nameError, setNameError] = useState('')
  const [fileError, setFileError] = useState('')
  const [translateEnabled, setTranslateEnabled] = useState(false)
  const [translateTo, setTranslateTo] = useState<'en' | 'de'>('en')

  const mutation = useMutation({
    mutationFn: () =>
      ingestApi.uploadDataset(
        file!,
        name,
        description || undefined,
        isPublic,
        translateEnabled ? translateTo : undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] })
      toast.success('Dataset uploaded successfully')
      handleClose()
    },
    onError: () => toast.error('Upload failed'),
  })

  const handleClose = () => {
    setName('')
    setDescription('')
    setIsPublic(false)
    setFile(null)
    setNameError('')
    setFileError('')
    setTranslateEnabled(false)
    setTranslateTo('en')
    onClose()
  }

  const handleSubmit = () => {
    let valid = true
    if (!name.trim()) {
      setNameError(t.upload.nameRequired)
      valid = false
    } else {
      setNameError('')
    }
    if (!file) {
      setFileError(t.upload.fileRequired)
      valid = false
    } else {
      setFileError('')
    }
    if (valid) mutation.mutate()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t.upload.title}
      description={t.upload.subtitle}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending} icon={<Upload size={14} />}>
            {t.common.upload}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={t.upload.nameLabel}
          placeholder={t.upload.namePlaceholder}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
        />

        <div className="w-full">
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {t.upload.descLabel}
          </label>
          <textarea
            className={cn(
              'block w-full rounded-md border border-gray-600 bg-gray-800 text-white placeholder-gray-500',
              'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
              'hover:border-gray-500 px-3 py-2 text-sm resize-none',
            )}
            rows={3}
            placeholder={t.upload.descPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* File picker */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">{t.upload.fileLabel}</label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'w-full rounded-md border border-dashed px-4 py-6 text-center transition-colors',
              fileError ? 'border-red-500' : 'border-gray-600 hover:border-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
            )}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
                <FileIcon size={16} className="text-blue-400 shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="text-gray-500 shrink-0">({formatBytes(file.size)})</span>
              </div>
            ) : (
              <div className="text-sm text-gray-400">
                <Upload size={20} className="mx-auto mb-1 text-gray-500" />
                {t.upload.clickToSelect}
                <p className="text-xs text-gray-600 mt-1">{t.upload.fileHint}</p>
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.xls,.json,.parquet"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              if (f) setFileError('')
              if (f && !name) setName(f.name.replace(/\.[^.]+$/, ''))
            }}
          />
          {fileError && <p className="mt-1.5 text-xs text-red-400">{fileError}</p>}
        </div>

        <Toggle checked={isPublic} onChange={setIsPublic} label={t.upload.isPublic} />

        {/* ── Translation section ── */}
        <div className="border-t border-gray-700 pt-4 space-y-3">
          <Toggle checked={translateEnabled} onChange={setTranslateEnabled} label={
            <span className="flex items-center gap-1.5">
              <Languages size={14} className="text-blue-400" />
              {t.upload.translateToggle}
            </span>
          } />

          {translateEnabled && (
            <div className="pl-12 space-y-2">
              <label className="block text-xs font-medium text-gray-400">
                {t.upload.translateToLabel}
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTranslateTo('en')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    translateTo === 'en'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-600/50'
                      : 'text-gray-400 border-gray-600 hover:border-gray-500 hover:text-white',
                  )}
                >
                  🇬🇧 {t.upload.english}
                </button>
                <button
                  onClick={() => setTranslateTo('de')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    translateTo === 'de'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-600/50'
                      : 'text-gray-400 border-gray-600 hover:border-gray-500 hover:text-white',
                  )}
                >
                  🇩🇪 {t.upload.german}
                </button>
              </div>
              <p className="text-xs text-gray-500">{t.upload.translateNote}</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
