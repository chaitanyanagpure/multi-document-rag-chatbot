'use client'

import React from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ToastContainer } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function AppLayout({ children, className, noPadding = false }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-dark-bg">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main
          className={cn(
            'flex-1 overflow-y-auto',
            !noPadding && 'p-6',
            className
          )}
        >
          {children}
        </main>
      </div>

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  )
}

export default AppLayout
