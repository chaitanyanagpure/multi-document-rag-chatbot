'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { authAPI } from '@/lib/api'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageLoader } from '@/components/ui/Spinner'

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, token, setUser, setLoading, isLoading, logout } = useAuthStore()
  const [isVerifying, setIsVerifying] = useState(true)

  useEffect(() => {
    const verifyAuth = async () => {
      const storedToken = localStorage.getItem('access_token')
      if (!storedToken) {
        logout()
        router.push('/')
        return
      }

      if (user) {
        setIsVerifying(false)
        return
      }

      try {
        const me = await authAPI.getMe()
        setUser(me)
        setLoading(false)
      } catch {
        logout()
        router.push('/')
      } finally {
        setIsVerifying(false)
      }
    }

    verifyAuth()
  }, [])

  if (isVerifying) {
    return <PageLoader message="Authenticating..." />
  }

  return (
    <AppLayout>
      {children}
    </AppLayout>
  )
}
