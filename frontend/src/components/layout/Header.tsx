'use client'

import React, { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Bell,
  Sun,
  Moon,
  Settings,
  LogOut,
  User,
  ChevronDown,
  X,
  Database,
  MessageSquare,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuthStore, useKBStore, useChatStore } from '@/lib/store'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

const PAGE_TITLES: Record<string, string> = {
  '/chat': 'Chat',
  '/knowledge-bases': 'Knowledge Bases',
  '/analytics': 'Analytics',
  '/admin': 'Admin Dashboard',
  '/settings': 'Settings',
  '/profile': 'Profile',
}

function getPageTitle(pathname: string): string {
  const matchedKey = Object.keys(PAGE_TITLES).find((key) => pathname.startsWith(key))
  return matchedKey ? PAGE_TITLES[matchedKey] : 'VerbaFlow AI'
}

interface HeaderProps {
  className?: string
}

export function Header({ className }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { theme, setTheme } = useTheme()
  
  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { knowledgeBases, setKnowledgeBases } = useKBStore()
  const { chats, setChats, setActiveChat } = useChatStore()
  
  // Profile dropdown state
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  
  // Notification state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState([
    {
      id: '1',
      title: 'Ingestion Complete',
      message: 'Document "financial_report_2025.pdf" successfully indexed.',
      time: '10m ago',
      read: false,
    },
    {
      id: '2',
      title: 'New KB Created',
      message: 'Knowledge Base "Research Papers" has been created.',
      time: '1h ago',
      read: false,
    },
  ])

  const searchRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  const pageTitle = getPageTitle(pathname)

  useEffect(() => setMounted(true), [])

  // Load KBs and Chats on mount when user is loaded to feed the search results
  useEffect(() => {
    if (mounted && user) {
      api.knowledgeBases.list().then(setKnowledgeBases).catch(console.error)
      api.chats.list().then(setChats).catch(console.error)
    }
  }, [mounted, user, setKnowledgeBases, setChats])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchRef.current) {
      searchRef.current.focus()
    }
  }, [isSearchOpen])

  const handleLogout = () => {
    logout()
    window.location.href = '/'
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const handleClearSearch = () => {
    if (searchQuery) {
      setSearchQuery('')
    } else {
      setIsSearchOpen(false)
    }
  }

  const handleBellClick = () => {
    setIsNotificationsOpen(!isNotificationsOpen)
    setIsProfileOpen(false)
    setIsSearchOpen(false)
  }

  // Search filter logic
  const filteredKBs = searchQuery.trim()
    ? knowledgeBases.filter((kb) =>
        kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kb.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const filteredChats = searchQuery.trim()
    ? chats.filter((chat) =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const hasSearchResults = filteredKBs.length > 0 || filteredChats.length > 0
  const unreadNotificationsCount = notifications.filter(n => !n.read).length

  return (
    <header
      className={cn(
        'h-16 flex items-center justify-between px-6 border-b border-dark-border/60',
        'bg-dark-bg/80 backdrop-blur-md sticky top-0 z-30',
        className
      )}
    >
      {/* Left: Page Title */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-text-primary">{pageTitle}</h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {isSearchOpen ? (
              <motion.div
                key="search-open"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="relative overflow-hidden"
              >
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full h-9 bg-dark-card border border-dark-border rounded-xl pl-8 pr-8 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-indigo-500/60 focus:shadow-[0_0_0_2px_rgba(79,70,229,0.1)] transition-all"
                  onKeyDown={(e) => e.key === 'Escape' && setIsSearchOpen(false)}
                />
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="search-closed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setIsSearchOpen(true)
                  setIsNotificationsOpen(false)
                  setIsProfileOpen(false)
                }}
                className="h-9 w-9 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-dark-hover transition-all duration-200"
                aria-label="Search"
              >
                <Search size={18} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Search Results Popover */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute right-0 top-full mt-2 w-80 glass-card rounded-xl border border-dark-border z-50 p-2 shadow-glass max-h-96 overflow-y-auto">
              {hasSearchResults ? (
                <div className="space-y-4 p-2">
                  {filteredKBs.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 px-2">Knowledge Bases</h3>
                      <div className="space-y-1">
                        {filteredKBs.map((kb) => (
                          <Link
                            key={kb.id}
                            href={`/knowledge-bases/${kb.id}`}
                            onClick={() => {
                              setSearchQuery('')
                              setIsSearchOpen(false)
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-dark-hover hover:text-text-primary transition-all duration-150"
                          >
                            <Database size={14} className="text-indigo-400 shrink-0" />
                            <span className="truncate">{kb.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredChats.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 px-2">Chats</h3>
                      <div className="space-y-1">
                        {filteredChats.map((chat) => (
                          <button
                            key={chat.id}
                            onClick={() => {
                              setActiveChat(chat)
                              router.push('/chat')
                              setSearchQuery('')
                              setIsSearchOpen(false)
                            }}
                            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-dark-hover hover:text-text-primary transition-all duration-150"
                          >
                            <MessageSquare size={14} className="text-violet-400 shrink-0" />
                            <span className="truncate">{chat.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-text-muted">
                  No results found for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        {mounted && (
          <button
            onClick={toggleTheme}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-dark-hover transition-all duration-200"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait">
              {theme === 'dark' ? (
                <motion.div
                  key="sun"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun size={18} />
                </motion.div>
              ) : (
                <motion.div
                  key="moon"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon size={18} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        )}

        {/* Notification Bell */}
        <div ref={notificationsRef} className="relative">
          <button
            onClick={handleBellClick}
            className={cn(
              'relative h-9 w-9 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-dark-hover transition-all duration-200',
              isNotificationsOpen && 'bg-dark-hover'
            )}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadNotificationsCount > 0 && (
              <span className="notification-badge">{unreadNotificationsCount}</span>
            )}
          </button>

          <AnimatePresence>
            {isNotificationsOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="absolute right-0 top-full mt-2 w-80 glass-card rounded-xl border border-dark-border overflow-hidden z-50 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
              >
                {/* Panel Header */}
                <div className="px-4 py-3 border-b border-dark-border/60 flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-primary">Notifications</p>
                  {notifications.length > 0 && (
                    <button
                      onClick={() => setNotifications([])}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-72 overflow-y-auto divide-y divide-dark-border/40">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div key={n.id} className="p-3.5 hover:bg-dark-hover transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-text-primary">{n.title}</p>
                          <span className="text-[10px] text-text-muted shrink-0">{n.time}</span>
                        </div>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-text-muted">
                      No new notifications
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-dark-border mx-1" />

        {/* Profile Dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={cn(
              'flex items-center gap-2.5 px-2 py-1.5 rounded-xl',
              'hover:bg-dark-hover transition-all duration-200',
              isProfileOpen && 'bg-dark-hover'
            )}
          >
            <Avatar
              name={user?.full_name || ''}
              src={user?.avatar_url}
              size="sm"
              showStatus
              status="online"
            />
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-text-primary leading-tight truncate max-w-[120px]">
                {user?.full_name || 'User'}
              </p>
              <p className="text-[10px] text-text-muted truncate max-w-[120px]">
                {user?.role || 'Member'}
              </p>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                'text-text-muted transition-transform duration-200',
                isProfileOpen && 'rotate-180'
              )}
            />
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="absolute right-0 top-full mt-2 w-56 glass-card rounded-xl border border-dark-border overflow-hidden z-50 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-dark-border/60">
                  <p className="text-sm font-semibold text-text-primary">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-text-muted truncate">{user?.email}</p>
                </div>

                <div className="p-1.5 space-y-0.5">
                  <DropdownItem icon={User} href="/profile" onClick={() => setIsProfileOpen(false)}>
                    Profile
                  </DropdownItem>
                  <DropdownItem icon={Settings} href="/settings" onClick={() => setIsProfileOpen(false)}>
                    Settings
                  </DropdownItem>
                  <div className="border-t border-dark-border/60 my-1" />
                  <DropdownItem
                    icon={LogOut}
                    onClick={() => {
                      setIsProfileOpen(false)
                      handleLogout()
                    }}
                    danger
                  >
                    Sign out
                  </DropdownItem>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

interface DropdownItemProps {
  icon: React.ComponentType<any>
  href?: string
  onClick?: () => void
  danger?: boolean
  children: React.ReactNode
}

function DropdownItem({ icon: Icon, href, onClick, danger = false, children }: DropdownItemProps) {
  const classes = cn(
    'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all duration-150',
    danger
      ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
      : 'text-text-secondary hover:bg-dark-hover hover:text-text-primary'
  )

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        <Icon size={15} />
        {children}
      </Link>
    )
  }

  return (
    <button className={classes} onClick={onClick}>
      <Icon size={15} />
      {children}
    </button>
  )
}

export default Header
