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
  User,
  Building2,
  ArrowRight,
  Loader2,
  Check,
  X as XIcon,
} from 'lucide-react'
import { authAPI } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { checkPasswordStrength } from '@/lib/utils'
import { cn } from '@/lib/utils'

const registerSchema = z
  .object({
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    organization_name: z.string().min(2, 'Organization name must be at least 2 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
    terms: z.boolean().refine((val) => val === true, 'You must accept the terms'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const { setUser, setToken, isAuthenticated } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [passwordValue, setPasswordValue] = useState('')

  const strength = checkPasswordStrength(passwordValue)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const watchPassword = watch('password', '')

  useEffect(() => {
    setPasswordValue(watchPassword || '')
  }, [watchPassword])

  useEffect(() => {
    if (isAuthenticated) router.push('/chat')
  }, [isAuthenticated, router])

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    setServerError(null)
    try {
      const response = await authAPI.register({
        full_name: data.full_name,
        email: data.email,
        organization_name: data.organization_name,
        password: data.password,
      })
      setToken(response.access_token, response.refresh_token)
      setUser(response.user)
      router.push('/chat')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setServerError(
        error?.response?.data?.detail ||
        'Registration failed. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const strengthLabels = ['', 'Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthWidths = [0, 20, 40, 60, 80, 100]

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col w-5/12 relative overflow-hidden gradient-bg">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
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

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 flex flex-col justify-center"
          >
            <h1 className="text-4xl font-black text-white leading-tight mb-6">
              Start your{' '}
              <span className="gradient-text">knowledge</span>{' '}
              journey today
            </h1>
            <p className="text-lg text-indigo-200 leading-relaxed mb-10">
              Join thousands of enterprises using VerbaFlow AI to unlock the intelligence in
              their documents.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '10,000+', label: 'Organizations' },
                { value: '50M+', label: 'Documents Indexed' },
                { value: '99.9%', label: 'Uptime SLA' },
                { value: '< 2s', label: 'Avg Response Time' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="glass-card-light rounded-xl p-4 text-center"
                >
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-indigo-300 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <p className="text-xs text-indigo-400 relative z-10">
            © 2026 VerbaFlow AI. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Register Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-dark-bg overflow-y-auto">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-lg py-8 relative z-10"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <p className="text-lg font-bold gradient-text">VerbaFlow AI</p>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-text-primary mb-2">Create your account</h2>
            <p className="text-text-secondary">
              Set up your workspace in under 2 minutes
            </p>
          </div>

          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm"
            >
              {serverError}
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Full name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  {...register('full_name')}
                  type="text"
                  placeholder="John Doe"
                  className={cn('form-input pl-10', errors.full_name && 'border-red-500/70')}
                  autoComplete="name"
                />
              </div>
              {errors.full_name && <p className="text-xs text-red-400">{errors.full_name.message}</p>}
            </div>

            {/* Organization */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Organization name</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  {...register('organization_name')}
                  type="text"
                  placeholder="Acme Corporation"
                  className={cn('form-input pl-10', errors.organization_name && 'border-red-500/70')}
                  autoComplete="organization"
                />
              </div>
              {errors.organization_name && (
                <p className="text-xs text-red-400">{errors.organization_name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Work email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@company.com"
                  className={cn('form-input pl-10', errors.email && 'border-red-500/70')}
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  className={cn('form-input pl-10 pr-10', errors.password && 'border-red-500/70')}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Strength */}
              {passwordValue && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-dark-border rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${strengthWidths[strength.score]}%` }}
                        transition={{ duration: 0.4 }}
                        className="h-full rounded-full transition-colors"
                        style={{ backgroundColor: strength.color }}
                      />
                    </div>
                    <span className="text-xs font-medium" style={{ color: strength.color }}>
                      {strengthLabels[strength.score]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { key: 'length', label: '8+ characters' },
                      { key: 'uppercase', label: 'Uppercase letter' },
                      { key: 'number', label: 'Number' },
                      { key: 'special', label: 'Special character' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-1.5">
                        {strength.checks[key as keyof typeof strength.checks] ? (
                          <Check size={11} className="text-emerald-400 shrink-0" />
                        ) : (
                          <XIcon size={11} className="text-text-muted shrink-0" />
                        )}
                        <span className={cn(
                          'text-xs',
                          strength.checks[key as keyof typeof strength.checks]
                            ? 'text-emerald-400'
                            : 'text-text-muted'
                        )}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Confirm password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  {...register('confirm_password')}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  className={cn('form-input pl-10 pr-10', errors.confirm_password && 'border-red-500/70')}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="text-xs text-red-400">{errors.confirm_password.message}</p>
              )}
            </div>

            {/* Terms */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  {...register('terms')}
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded border-dark-border bg-dark-card accent-indigo-500 cursor-pointer shrink-0"
                />
                <span className="text-sm text-text-secondary leading-relaxed">
                  I agree to the{' '}
                  <button type="button" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button type="button" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                    Privacy Policy
                  </button>
                </span>
              </label>
              {errors.terms && <p className="text-xs text-red-400 mt-1">{errors.terms.message}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'glow-btn w-full py-3 rounded-xl text-white font-semibold text-sm',
                'flex items-center justify-center gap-2 mt-2',
                isLoading && 'opacity-70 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link href="/" className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
