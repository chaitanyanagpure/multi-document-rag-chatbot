'use client'

import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'icon'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
  children?: React.ReactNode
}

const variantStyles: Record<string, string> = {
  primary:
    'glow-btn text-white font-semibold shadow-glow-indigo disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
  secondary:
    'bg-dark-card border border-dark-border text-text-primary hover:bg-dark-hover hover:border-indigo-600/50 transition-all duration-200',
  ghost:
    'bg-transparent text-text-secondary hover:bg-dark-hover hover:text-text-primary transition-all duration-200',
  danger:
    'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-200',
  outline:
    'bg-transparent border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500 transition-all duration-200',
  icon:
    'bg-dark-card border border-dark-border text-text-secondary hover:bg-dark-hover hover:text-text-primary hover:border-indigo-500/30 transition-all duration-200 rounded-xl',
}

const sizeStyles: Record<string, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-lg',
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-11 px-5 text-base rounded-xl',
  xl: 'h-13 px-7 text-base rounded-2xl',
  icon: 'h-9 w-9 p-0 flex items-center justify-center rounded-xl',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      children,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading

    return (
      <motion.button
        ref={ref}
        whileHover={!isDisabled ? { scale: 1.01 } : undefined}
        whileTap={!isDisabled ? { scale: 0.97 } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn(
          'relative inline-flex items-center justify-center gap-2 font-medium select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
          variantStyles[variant] || variantStyles.primary,
          variant === 'icon' ? sizeStyles.icon : sizeStyles[size],
          fullWidth && 'w-full',
          isDisabled && 'opacity-60 cursor-not-allowed',
          className
        )}
        disabled={isDisabled}
        onClick={isDisabled ? undefined : onClick}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon ? (
          <span className="shrink-0">{rightIcon}</span>
        ) : null}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'

export default Button
