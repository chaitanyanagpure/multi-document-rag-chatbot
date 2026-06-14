'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useUIStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const toastConfig = {
  success: {
    icon: CheckCircle,
    containerClass: 'border-emerald-500/30 bg-emerald-500/10',
    iconClass: 'text-emerald-400',
    titleClass: 'text-emerald-300',
  },
  error: {
    icon: AlertCircle,
    containerClass: 'border-red-500/30 bg-red-500/10',
    iconClass: 'text-red-400',
    titleClass: 'text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'border-amber-500/30 bg-amber-500/10',
    iconClass: 'text-amber-400',
    titleClass: 'text-amber-300',
  },
  info: {
    icon: Info,
    containerClass: 'border-blue-500/30 bg-blue-500/10',
    iconClass: 'text-blue-400',
    titleClass: 'text-blue-300',
  },
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts)
  const removeToast = useUIStore((s) => s.removeToast)

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const config = toastConfig[toast.type]
          const Icon = config.icon

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 25 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border',
                'backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
                'min-w-[300px] max-w-[400px]',
                config.containerClass
              )}
            >
              <Icon size={18} className={cn('shrink-0 mt-0.5', config.iconClass)} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-semibold', config.titleClass)}>
                  {toast.title}
                </p>
                {toast.message && (
                  <p className="mt-0.5 text-xs text-text-muted">{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-0.5 rounded-md text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export default ToastContainer
