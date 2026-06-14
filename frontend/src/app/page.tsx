'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Zap,
  Shield,
  Brain,
  BarChart3,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { authAPI } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import Script from 'next/script'


const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  remember_me: z.boolean().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

const features = [
  {
    icon: Brain,
    title: 'Multi-Document RAG',
    description: 'Query across all your documents with AI-powered retrieval.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'SOC 2 compliant with RBAC and full audit trails.',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Real-time insights into usage, costs, and performance.',
  },
]

// Floating particle component
const Particle = ({ style }: { style: React.CSSProperties }) => (
  <div
    className="absolute rounded-full opacity-30 pointer-events-none"
    style={style}
  />
)

export default function LoginPage() {
  const router = useRouter()
  const { setUser, setToken, isAuthenticated } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember_me: false },
  })

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/chat')
    }
  }, [isAuthenticated, router])

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setServerError(null)
    try {
      const response = await authAPI.login(data)
      setToken(response.access_token, response.refresh_token)
      setUser(response.user)
      router.push('/chat')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setServerError(
        error?.response?.data?.detail || 'Invalid email or password. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    if (typeof window === 'undefined' || !(window as any).google) {
      setServerError('Google Sign-In is still loading. Please try again in a moment.')
      return
    }
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!googleClientId) {
      setServerError('Google Client ID is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment.')
      return
    }
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        callback: async (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            setIsLoading(true)
            setServerError(null)
            try {
              const response = await authAPI.googleLogin(tokenResponse.access_token)
              setToken(response.access_token, response.refresh_token)
              setUser(response.user)
              router.push('/chat')
            } catch (err: unknown) {
              const error = err as { response?: { data?: { detail?: string } } }
              setServerError(
                error?.response?.data?.detail || 'Google authentication failed. Please try again.'
              )
            } finally {
              setIsLoading(false)
            }
          }
        },
      })
      client.requestAccessToken()
    } catch (err) {
      console.error('Failed to initialize Google token client:', err)
      setServerError('Google Sign-In failed to initialize.')
    }
  }


  const particles = Array.from({ length: 20 }, (_, i) => ({
    width: `${Math.random() * 60 + 10}px`,
    height: `${Math.random() * 60 + 10}px`,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    background: i % 2 === 0
      ? 'rgba(79, 70, 229, 0.4)'
      : 'rgba(124, 58, 237, 0.3)',
    animationDuration: `${Math.random() * 10 + 8}s`,
    animationDelay: `${Math.random() * 5}s`,
    animation: `float ${Math.random() * 10 + 8}s ease-in-out infinite`,
  }))

  return (
    <div className="min-h-screen flex">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="beforeInteractive"
      />
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex flex-col w-1/2 relative overflow-hidden gradient-bg">
        {/* Animated particles */}
        {particles.map((style, i) => (
          <Particle key={i} style={style} />
        ))}

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-glow-indigo">
              <Zap size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">VerbaFlow AI</p>
              <p className="text-xs text-indigo-300">Enterprise Platform</p>
            </div>
          </motion.div>

          {/* Hero Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex-1 flex flex-col justify-center"
          >
            <h1 className="text-5xl font-black text-white leading-tight mb-6">
              Your Enterprise{' '}
              <span className="gradient-text">Knowledge</span>{' '}
              Intelligence Platform
            </h1>
            <p className="text-lg text-indigo-200 leading-relaxed mb-12 max-w-md">
              Transform your organization&apos;s documents into an intelligent knowledge base.
              Ask questions, get instant answers with citations.
            </p>

            {/* Feature Cards */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                  className="flex items-start gap-4 glass-card-light rounded-2xl p-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 flex items-center justify-center shrink-0">
                    <feature.icon size={20} className="text-indigo-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{feature.title}</p>
                    <p className="text-xs text-indigo-200 mt-0.5 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Bottom */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-xs text-indigo-400"
          >
            © 2026 VerbaFlow AI. All rights reserved.
          </motion.p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-dark-bg relative overflow-hidden">
        {/* Subtle background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <p className="text-lg font-bold gradient-text">VerbaFlow AI</p>
              <p className="text-xs text-text-muted">Enterprise Platform</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-text-primary mb-2">Welcome back</h2>
            <p className="text-text-secondary">
              Sign in to your workspace
            </p>
          </div>

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-dark-card border border-dark-border text-text-secondary hover:bg-dark-hover hover:border-dark-border/80 hover:text-text-primary transition-all duration-200 mb-6 text-sm font-medium"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
              <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4"/>
              <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853"/>
              <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z" fill="#FBBC04"/>
              <path d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4055 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 border-t border-dark-border" />
            <span className="text-xs text-text-muted">or sign in with email</span>
            <div className="flex-1 border-t border-dark-border" />
          </div>

          {/* Server Error */}
          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm"
            >
              {serverError}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Email address</label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@company.com"
                  className={cn(
                    'form-input pl-10',
                    errors.email && 'border-red-500/70 focus:border-red-500'
                  )}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Password</label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className={cn(
                    'form-input pl-10 pr-10',
                    errors.password && 'border-red-500/70 focus:border-red-500'
                  )}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  {...register('remember_me')}
                  type="checkbox"
                  className="w-4 h-4 rounded border-dark-border bg-dark-card accent-indigo-500 cursor-pointer"
                />
                <span className="text-sm text-text-secondary">Remember me</span>
              </label>
              <button
                type="button"
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'glow-btn w-full py-3 rounded-xl text-white font-semibold text-sm',
                'flex items-center justify-center gap-2',
                isLoading && 'opacity-70 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
            >
              Create account
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
