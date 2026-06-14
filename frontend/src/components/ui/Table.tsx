'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronUp,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  width?: string
  render?: (value: unknown, row: T, index: number) => React.ReactNode
  className?: string
}

interface TableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  rowKey?: keyof T | ((row: T) => string)
  onRowClick?: (row: T) => void
  rowActions?: (row: T) => React.ReactNode
  pagination?: {
    page: number
    perPage: number
    total: number
    onPageChange: (page: number) => void
  }
  className?: string
}

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data found',
  emptyIcon,
  rowKey,
  onRowClick,
  rowActions,
  pagination,
  className,
}: TableProps<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)

  const getRowKey = useCallback(
    (row: T, index: number): string => {
      if (!rowKey) return String(index)
      if (typeof rowKey === 'function') return rowKey(row)
      return String(row[rowKey])
    },
    [rowKey]
  )

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === 'asc'
          ? { key, direction: 'desc' }
          : null
      }
      return { key, direction: 'asc' }
    })
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig) return 0
    const aVal = a[sortConfig.key]
    const bVal = b[sortConfig.key]
    if (aVal === bVal) return 0
    const comparison = aVal! > bVal! ? 1 : -1
    return sortConfig.direction === 'asc' ? comparison : -comparison
  })

  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.perPage)
    : 1

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="overflow-x-auto rounded-2xl glass-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted',
                    col.sortable && 'cursor-pointer hover:text-text-secondary transition-colors select-none',
                    col.width && `w-[${col.width}]`,
                    col.className
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      <span className="flex flex-col">
                        <ChevronUp
                          size={10}
                          className={cn(
                            'transition-colors',
                            sortConfig?.key === col.key && sortConfig.direction === 'asc'
                              ? 'text-indigo-400'
                              : 'text-dark-border'
                          )}
                        />
                        <ChevronDown
                          size={10}
                          className={cn(
                            '-mt-0.5 transition-colors',
                            sortConfig?.key === col.key && sortConfig.direction === 'desc'
                              ? 'text-indigo-400'
                              : 'text-dark-border'
                          )}
                        />
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {rowActions && (
                <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted w-16">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-dark-border/30">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <div className="skeleton h-4 rounded" style={{ width: '60%' }} />
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3.5">
                      <div className="skeleton h-4 w-8 rounded ml-auto" />
                    </td>
                  )}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-3">
                    {emptyIcon && (
                      <div className="text-text-muted opacity-50">{emptyIcon}</div>
                    )}
                    <p className="text-sm text-text-muted">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
                <motion.tr
                  key={getRowKey(row, index)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn(
                    'border-b border-dark-border/30 transition-colors duration-150',
                    'hover:bg-dark-hover/50',
                    index === sortedData.length - 1 && 'border-b-0',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-4 py-3.5 text-sm text-text-secondary', col.className)}
                    >
                      {col.render
                        ? col.render(row[col.key], row, index)
                        : String(row[col.key] ?? '')}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3.5 text-right">
                      {rowActions(row)}
                    </td>
                  )}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            Showing{' '}
            <span className="font-medium text-text-secondary">
              {(pagination.page - 1) * pagination.perPage + 1}
            </span>{' '}
            to{' '}
            <span className="font-medium text-text-secondary">
              {Math.min(pagination.page * pagination.perPage, pagination.total)}
            </span>{' '}
            of{' '}
            <span className="font-medium text-text-secondary">{pagination.total}</span> results
          </p>
          <div className="flex items-center gap-1">
            <PaginationButton
              onClick={() => pagination.onPageChange(1)}
              disabled={pagination.page === 1}
            >
              <ChevronsLeft size={14} />
            </PaginationButton>
            <PaginationButton
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              <ChevronLeft size={14} />
            </PaginationButton>
            {generatePageNumbers(pagination.page, totalPages).map((page, i) =>
              page === '...' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-text-muted">
                  <MoreHorizontal size={14} />
                </span>
              ) : (
                <PaginationButton
                  key={page}
                  onClick={() => pagination.onPageChange(Number(page))}
                  active={page === pagination.page}
                >
                  {page}
                </PaginationButton>
              )
            )}
            <PaginationButton
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page === totalPages}
            >
              <ChevronRight size={14} />
            </PaginationButton>
            <PaginationButton
              onClick={() => pagination.onPageChange(totalPages)}
              disabled={pagination.page === totalPages}
            >
              <ChevronsRight size={14} />
            </PaginationButton>
          </div>
        </div>
      )}
    </div>
  )
}

function PaginationButton({
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'min-w-[32px] h-8 px-2 rounded-lg text-sm flex items-center justify-center transition-all duration-150',
        active
          ? 'bg-indigo-500 text-white font-medium'
          : 'text-text-secondary hover:bg-dark-hover hover:text-text-primary',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

export default Table
