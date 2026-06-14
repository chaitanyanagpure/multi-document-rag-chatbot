'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  Database,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
  User,
} from 'lucide-react'
import { useAuthStore, useUIStore } from '@/lib/store'
import { Avatar } from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'Chat',
    href: '/chat',
    icon: MessageSquare,
    description: 'AI conversations',
  },
  {
    label: 'Knowledge Bases',
    href: '/knowledge-bases',
    icon: Database,
    description: 'Manage documents',
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Usage insights',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Configuration',
  },
]

const adminNavItems = [
  {
    label: 'Admin',
    href: '/admin',
    icon: Shield,
    description: 'System management',
    adminOnly: true,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  const isActive = (href: string) => pathname.startsWith(href)

  const handleLogout = async () => {
    logout()
    window.location.href = '/'
  }

  const allNavItems = [
    ...navItems,
    ...(user?.role === 'admin' ? adminNavItems : []),
  ]

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative flex flex-col h-full bg-dark-card border-r border-dark-border overflow-hidden shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-dark-border/60 shrink-0">
        <Link href="/chat" className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-glow-indigo">
            <Zap size={18} className="text-white" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="min-w-0"
              >
                <p className="text-sm font-bold gradient-text truncate">VerbaFlow AI</p>
                <p className="text-[10px] text-text-muted truncate">Enterprise Platform</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 space-y-1">
        {allNavItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          const itemContent = (
            <Link
              href={item.href}
              className={cn(
                'nav-item w-full',
                active && 'active',
                sidebarCollapsed && 'justify-center px-2'
              )}
            >
              <Icon
                size={20}
                className={cn(
                  'shrink-0 transition-colors',
                  active ? 'text-indigo-400' : 'text-text-muted group-hover:text-text-secondary'
                )}
              />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                    className="truncate text-sm"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {active && !sidebarCollapsed && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute right-2 w-1.5 h-5 bg-indigo-500 rounded-full"
                />
              )}
            </Link>
          )

          return (
            <div key={item.href} className="relative group">
              {sidebarCollapsed ? (
                <Tooltip content={item.label} placement="right">
                  {itemContent}
                </Tooltip>
              ) : (
                itemContent
              )}
            </div>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="px-4">
        <div className="border-t border-dark-border/60" />
      </div>

      {/* Profile + Logout */}
      <div className="p-3 space-y-1 shrink-0">
        <Link
          href="/profile"
          className={cn(
            'nav-item w-full',
            pathname === '/profile' && 'active',
            sidebarCollapsed && 'justify-center px-2'
          )}
        >
          <Avatar
            name={user?.full_name || ''}
            src={user?.avatar_url}
            size="sm"
            showStatus
            status="online"
          />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-text-primary truncate">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-[10px] text-text-muted truncate">
                  {user?.organization?.name || user?.email || ''}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        <div className="relative group">
          {sidebarCollapsed ? (
            <Tooltip content="Logout" placement="right">
              <button
                onClick={handleLogout}
                className="nav-item w-full justify-center px-2 hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut size={18} className="shrink-0" />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="nav-item w-full hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut size={18} className="shrink-0" />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm"
                  >
                    Logout
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebar}
        className={cn(
          'absolute -right-3 top-20 z-10',
          'w-6 h-6 rounded-full',
          'bg-dark-card border border-dark-border',
          'flex items-center justify-center',
          'text-text-muted hover:text-text-primary',
          'hover:border-indigo-500/50 hover:bg-dark-hover',
          'transition-all duration-200 shadow-md'
        )}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  )
}

export default Sidebar
