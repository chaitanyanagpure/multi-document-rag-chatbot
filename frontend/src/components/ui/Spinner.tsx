'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  color?: 'indigo' | 'violet' | 'white' | 'current'
}

const sizeClasses = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
  xl: 'h-12 w-12 border-3',
}

const colorClasses = {
  indigo: 'border-indigo-500/20 border-t-indigo-500',
  violet: 'border-violet-500/20 border-t-violet-500',
  white: 'border-white/20 border-t-white',
  current: 'border-current/20 border-t-current',
}

export function Spinner({ size = 'md', className, color = 'indigo' }: SpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  )
}

// Full page loading spinner
export function PageLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-dark-bg/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        <div className="absolute inset-2 rounded-full border border-violet-500/20 border-t-violet-500 animate-spin animation-delay-150" />
      </div>
      {message && (
        <p className="text-sm text-text-secondary animate-pulse">{message}</p>
      )}
    </div>
  )
}

// Skeleton loader
interface SkeletonProps {
  className?: string
  width?: string
  height?: string
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton rounded-lg', className)}
      style={{ width, height }}
    />
  )
}

export default Spinner
