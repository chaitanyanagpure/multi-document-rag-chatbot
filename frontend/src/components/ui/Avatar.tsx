'use client'

import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { generateAvatarColor, getInitials } from '@/lib/utils'

interface AvatarProps {
  name?: string
  src?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  showStatus?: boolean
  status?: 'online' | 'offline' | 'away' | 'busy'
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-20 h-20 text-xl',
}

const statusColors = {
  online: 'bg-emerald-400',
  offline: 'bg-slate-500',
  away: 'bg-amber-400',
  busy: 'bg-red-400',
}

const statusSizes = {
  xs: 'w-1.5 h-1.5 border',
  sm: 'w-2 h-2 border',
  md: 'w-2.5 h-2.5 border-2',
  lg: 'w-3 h-3 border-2',
  xl: 'w-4 h-4 border-2',
  '2xl': 'w-4 h-4 border-2',
}

export function Avatar({
  name = '',
  src,
  size = 'md',
  className,
  showStatus = false,
  status = 'offline',
}: AvatarProps) {
  const colors = generateAvatarColor(name)
  const initials = getInitials(name)

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={cn(
          'relative rounded-full overflow-hidden flex items-center justify-center font-semibold select-none',
          sizeClasses[size],
          className
        )}
        style={!src ? { backgroundColor: colors.bg, color: colors.text } : undefined}
      >
        {src ? (
          <Image
            src={src}
            alt={name || 'Avatar'}
            fill
            className="object-cover"
            sizes={`${parseInt(sizeClasses[size].split('w-')[1]) * 4}px`}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {showStatus && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-dark-bg',
            statusColors[status],
            statusSizes[size]
          )}
        />
      )}
    </div>
  )
}

// Avatar Group
interface AvatarGroupProps {
  users: Array<{ name: string; src?: string }>
  max?: number
  size?: AvatarProps['size']
  className?: string
}

export function AvatarGroup({ users, max = 5, size = 'sm', className }: AvatarGroupProps) {
  const visible = users.slice(0, max)
  const remaining = users.length - max

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visible.map((user, index) => (
        <div key={index} className="ring-2 ring-dark-bg rounded-full">
          <Avatar name={user.name} src={user.src} size={size} />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'rounded-full ring-2 ring-dark-bg flex items-center justify-center bg-dark-elevated text-text-muted font-medium text-xs',
            sizeClasses[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}

export default Avatar
