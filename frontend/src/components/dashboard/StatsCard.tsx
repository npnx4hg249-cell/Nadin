import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: {
    value: number
    label: string
  }
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
  loading?: boolean
}

const colorStyles = {
  blue: {
    icon: 'bg-blue-900/40 border-blue-800 text-blue-400',
    trend: 'text-emerald-400',
  },
  green: {
    icon: 'bg-emerald-900/40 border-emerald-800 text-emerald-400',
    trend: 'text-emerald-400',
  },
  purple: {
    icon: 'bg-purple-900/40 border-purple-800 text-purple-400',
    trend: 'text-emerald-400',
  },
  orange: {
    icon: 'bg-orange-900/40 border-orange-800 text-orange-400',
    trend: 'text-emerald-400',
  },
  red: {
    icon: 'bg-red-900/40 border-red-800 text-red-400',
    trend: 'text-red-400',
  },
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
  loading,
}: StatsCardProps) {
  const colors = colorStyles[color]

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-24 bg-gray-700 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-700 rounded animate-pulse" />
            <div className="h-3 w-32 bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="w-11 h-11 rounded-lg bg-gray-700 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider truncate">
            {title}
          </p>
          <p className="text-2xl font-bold text-white tabular-nums">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 pt-1">
              {trend.value > 0 ? (
                <TrendingUp size={12} className="text-emerald-400" />
              ) : trend.value < 0 ? (
                <TrendingDown size={12} className="text-red-400" />
              ) : (
                <Minus size={12} className="text-gray-500" />
              )}
              <span
                className={cn(
                  'text-xs',
                  trend.value > 0
                    ? 'text-emerald-400'
                    : trend.value < 0
                    ? 'text-red-400'
                    : 'text-gray-500',
                )}
              >
                {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
              </span>
            </div>
          )}
        </div>
        <div
          className={cn(
            'w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 ml-4',
            colors.icon,
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}
