'use client'

import React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'violet' | 'indigo'
type BadgeSize = 'sm' | 'md' | 'lg'

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  error: 'bg-red-500/15 text-red-400 border border-red-500/25',
  info: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  neutral: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
  violet: 'bg-violet-500/15 text-violet-400 border border-violet-500/25',
  indigo: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25',
}

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
  info: 'bg-blue-400',
  neutral: 'bg-slate-400',
  violet: 'bg-violet-400',
  indigo: 'bg-indigo-400',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5 rounded-md',
  md: 'text-xs px-2.5 py-1 rounded-lg',
  lg: 'text-sm px-3 py-1 rounded-lg',
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'inline-block rounded-full shrink-0',
            size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
            dotColors[variant]
          )}
        />
      )}
      {children}
    </span>
  )
}

// Status badge specifically for document/KB status
export function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { variant: BadgeVariant; label: string }> = {
    active: { variant: 'success', label: 'Active' },
    indexing: { variant: 'info', label: 'Indexing' },
    processing: { variant: 'info', label: 'Processing' },
    embedding: { variant: 'info', label: 'Embedding' },
    extracting: { variant: 'info', label: 'Extracting' },
    chunking: { variant: 'info', label: 'Chunking' },
    pending: { variant: 'warning', label: 'Pending' },
    completed: { variant: 'success', label: 'Completed' },
    failed: { variant: 'error', label: 'Failed' },
    error: { variant: 'error', label: 'Error' },
    empty: { variant: 'neutral', label: 'Empty' },
    healthy: { variant: 'success', label: 'Healthy' },
    degraded: { variant: 'warning', label: 'Degraded' },
    down: { variant: 'error', label: 'Down' },
    trial: { variant: 'warning', label: 'Trial' },
    cancelled: { variant: 'error', label: 'Cancelled' },
    inactive: { variant: 'neutral', label: 'Inactive' },
    enterprise: { variant: 'violet', label: 'Enterprise' },
    professional: { variant: 'indigo', label: 'Pro' },
    starter: { variant: 'info', label: 'Starter' },
    free: { variant: 'neutral', label: 'Free' },
    admin: { variant: 'violet', label: 'Admin' },
    manager: { variant: 'indigo', label: 'Manager' },
    user: { variant: 'info', label: 'User' },
    viewer: { variant: 'neutral', label: 'Viewer' },
  }

  const config = statusMap[status.toLowerCase()] || { variant: 'neutral' as BadgeVariant, label: status }

  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  )
}

export default Badge
