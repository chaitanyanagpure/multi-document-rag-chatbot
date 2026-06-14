'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  children,
  className,
  hover = false,
  glow = false,
  padding = 'md',
  onClick,
}: CardProps) {
  const isInteractive = hover || !!onClick

  if (isInteractive) {
    return (
      <motion.div
        whileHover={{
          y: -3,
          boxShadow: glow
            ? '0 12px 40px rgba(0,0,0,0.3), 0 0 20px rgba(79,70,229,0.2)'
            : '0 12px 40px rgba(0,0,0,0.3)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className={cn(
          'glass-card rounded-2xl',
          paddingClasses[padding],
          isInteractive && 'cursor-pointer',
          className
        )}
        onClick={onClick}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div
      className={cn(
        'glass-card rounded-2xl',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  )
}

// Gradient Card variant
interface GradientCardProps {
  children: React.ReactNode
  className?: string
  from?: string
  to?: string
}

export function GradientCard({
  children,
  className,
  from = 'from-indigo-500/10',
  to = 'to-violet-500/10',
}: GradientCardProps) {
  return (
    <div
      className={cn(
        `glass-card rounded-2xl bg-gradient-to-br ${from} ${to} border border-indigo-500/20`,
        className
      )}
    >
      {children}
    </div>
  )
}

// Stat Card variant
interface StatCardProps {
  label: string
  value: string | number
  change?: number
  icon?: React.ReactNode
  iconColor?: string
  className?: string
  isLoading?: boolean
}

export function StatCard({
  label,
  value,
  change,
  icon,
  iconColor = 'text-indigo-400',
  className,
  isLoading = false,
}: StatCardProps) {
  const isPositiveChange = change !== undefined && change >= 0

  if (isLoading) {
    return (
      <div className={cn('glass-card rounded-2xl p-6', className)}>
        <div className="skeleton h-4 w-24 mb-3 rounded" />
        <div className="skeleton h-8 w-32 mb-2 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('glass-card rounded-2xl p-6', className)}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        {icon && (
          <div className={cn('p-2 rounded-xl bg-dark-elevated', iconColor)}>
            {icon}
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-text-primary mb-1">{value}</p>
      {change !== undefined && (
        <div className={cn('flex items-center gap-1 text-xs font-medium',
          isPositiveChange ? 'text-emerald-400' : 'text-red-400'
        )}>
          <span>{isPositiveChange ? '↑' : '↓'}</span>
          <span>{Math.abs(change).toFixed(1)}% vs last period</span>
        </div>
      )}
    </motion.div>
  )
}

export default Card
