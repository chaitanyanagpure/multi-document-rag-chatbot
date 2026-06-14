'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number // 0-100
  max?: number
  label?: string
  showValue?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'indigo' | 'violet' | 'success' | 'warning' | 'error' | 'gradient'
  animated?: boolean
  className?: string
}

const sizeClasses = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

const variantClasses = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  gradient: 'bg-gradient-to-r from-indigo-500 to-violet-500',
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  size = 'md',
  variant = 'gradient',
  animated = true,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
          {showValue && (
            <span className="text-xs font-medium text-text-muted">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full overflow-hidden',
          sizeClasses[size],
          'bg-dark-border/60'
        )}
      >
        {animated ? (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={cn('h-full rounded-full', variantClasses[variant])}
          />
        ) : (
          <div
            className={cn('h-full rounded-full', variantClasses[variant])}
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
    </div>
  )
}

// Step Progress (for ingestion)
interface StepProgressProps {
  steps: Array<{ name: string; status: 'pending' | 'active' | 'completed' | 'failed' }>
  className?: string
}

export function StepProgress({ steps, className }: StepProgressProps) {
  const completed = steps.filter((s) => s.status === 'completed').length
  const progress = (completed / steps.length) * 100

  return (
    <div className={cn('space-y-2', className)}>
      <ProgressBar value={progress} variant="gradient" />
      <p className="text-xs text-text-muted text-right">
        {completed}/{steps.length} steps completed
      </p>
    </div>
  )
}

export default ProgressBar
