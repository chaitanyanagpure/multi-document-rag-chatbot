import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek } from 'date-fns'

// ===========================
// Class Name Utility
// ===========================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ===========================
// Format Bytes
// ===========================

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

// ===========================
// Format Date
// ===========================

export function formatDate(dateString: string, formatStr: string = 'MMM d, yyyy'): string {
  try {
    return format(new Date(dateString), formatStr)
  } catch {
    return dateString
  }
}

export function formatRelativeDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (isToday(date)) {
      return format(date, "'Today at' h:mm a")
    }
    if (isYesterday(date)) {
      return format(date, "'Yesterday at' h:mm a")
    }
    if (isThisWeek(date)) {
      return format(date, "EEEE 'at' h:mm a")
    }
    return format(date, 'MMM d, yyyy')
  } catch {
    return dateString
  }
}

export function formatTimeAgo(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true })
  } catch {
    return dateString
  }
}

export function groupChatsByDate(chats: Array<{ created_at: string; updated_at: string; id: string }>): {
  pinned: typeof chats
  today: typeof chats
  yesterday: typeof chats
  thisWeek: typeof chats
  older: typeof chats
} {
  const now = new Date()
  const grouped = {
    pinned: [] as typeof chats,
    today: [] as typeof chats,
    yesterday: [] as typeof chats,
    thisWeek: [] as typeof chats,
    older: [] as typeof chats,
  }

  chats.forEach(chat => {
    const date = new Date(chat.updated_at || chat.created_at)
    if (isToday(date)) grouped.today.push(chat)
    else if (isYesterday(date)) grouped.yesterday.push(chat)
    else if (isThisWeek(date)) grouped.thisWeek.push(chat)
    else grouped.older.push(chat)
  })

  return grouped
}

// ===========================
// Truncate Text
// ===========================

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trim()}...`
}

// ===========================
// Generate Avatar Color
// ===========================

const AVATAR_COLORS = [
  { bg: '#4F46E5', text: '#FFFFFF' }, // Indigo
  { bg: '#7C3AED', text: '#FFFFFF' }, // Violet
  { bg: '#059669', text: '#FFFFFF' }, // Emerald
  { bg: '#D97706', text: '#FFFFFF' }, // Amber
  { bg: '#DC2626', text: '#FFFFFF' }, // Red
  { bg: '#0891B2', text: '#FFFFFF' }, // Cyan
  { bg: '#7C3AED', text: '#FFFFFF' }, // Purple
  { bg: '#BE185D', text: '#FFFFFF' }, // Pink
  { bg: '#9D174D', text: '#FFFFFF' }, // Rose
  { bg: '#1D4ED8', text: '#FFFFFF' }, // Blue
]

export function generateAvatarColor(name: string): { bg: string; text: string } {
  if (!name) return AVATAR_COLORS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

// ===========================
// Format Numbers
// ===========================

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount)
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// ===========================
// File Type Helpers
// ===========================

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

export function getFileTypeLabel(extension: string): string {
  const labels: Record<string, string> = {
    pdf: 'PDF',
    docx: 'Word',
    doc: 'Word',
    txt: 'Text',
    md: 'Markdown',
    csv: 'CSV',
    xlsx: 'Excel',
    xls: 'Excel',
    pptx: 'PowerPoint',
    ppt: 'PowerPoint',
    html: 'HTML',
    json: 'JSON',
  }
  return labels[extension] || extension.toUpperCase()
}

export function getFileTypeColor(extension: string): string {
  const colors: Record<string, string> = {
    pdf: '#EF4444',
    docx: '#3B82F6',
    doc: '#3B82F6',
    txt: '#6B7280',
    md: '#8B5CF6',
    csv: '#10B981',
    xlsx: '#10B981',
    xls: '#10B981',
    pptx: '#F59E0B',
    ppt: '#F59E0B',
    html: '#F97316',
    json: '#A78BFA',
  }
  return colors[extension] || '#6B7280'
}

// ===========================
// Password Strength
// ===========================

export interface PasswordStrength {
  score: number // 0-4
  label: string
  color: string
  checks: {
    length: boolean
    uppercase: boolean
    lowercase: boolean
    number: boolean
    special: boolean
  }
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }

  const passedChecks = Object.values(checks).filter(Boolean).length

  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['#EF4444', '#F97316', '#F59E0B', '#3B82F6', '#10B981']

  return {
    score: passedChecks,
    label: labels[passedChecks] || 'Very Weak',
    color: colors[passedChecks] || colors[0],
    checks,
  }
}

// ===========================
// URL Helpers
// ===========================

export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })
  const str = searchParams.toString()
  return str ? `?${str}` : ''
}

// ===========================
// Debounce
// ===========================

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// ===========================
// Generate ID
// ===========================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ===========================
// Similarity Score Color
// ===========================

export function getSimilarityColor(score: number): string {
  if (score >= 0.8) return '#10B981' // green
  if (score >= 0.6) return '#3B82F6' // blue
  if (score >= 0.4) return '#F59E0B' // amber
  return '#EF4444' // red
}

export function getSimilarityLabel(score: number): string {
  if (score >= 0.8) return 'High'
  if (score >= 0.6) return 'Good'
  if (score >= 0.4) return 'Fair'
  return 'Low'
}
