import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
type Size = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-500 text-white border border-blue-700 hover:border-blue-600 shadow-sm',
  secondary:
    'bg-gray-700 hover:bg-gray-600 text-gray-100 border border-gray-600 hover:border-gray-500 dark:bg-gray-700 dark:hover:bg-gray-600',
  danger:
    'bg-red-600 hover:bg-red-500 text-white border border-red-700 hover:border-red-600 shadow-sm',
  ghost:
    'bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white border border-transparent dark:hover:bg-gray-800',
  outline:
    'bg-transparent hover:bg-gray-800/50 text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500',
}

const sizeStyles: Record<Size, string> = {
  xs: 'px-2 py-1 text-xs rounded gap-1',
  sm: 'px-3 py-1.5 text-sm rounded gap-1.5',
  md: 'px-4 py-2 text-sm rounded-md gap-2',
  lg: 'px-5 py-2.5 text-base rounded-md gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin shrink-0" size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} />
      ) : (
        icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </button>
  )
}
