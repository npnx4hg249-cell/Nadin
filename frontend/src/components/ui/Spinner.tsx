import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: number
  className?: string
  label?: string
}

export function Spinner({ size = 24, className, label }: SpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      <Loader2
        size={size}
        className="animate-spin text-blue-500"
        aria-hidden="true"
      />
      {label && <span className="text-sm text-gray-400">{label}</span>}
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={32} label="Loading..." />
    </div>
  )
}
