import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuthStore } from '@/store/authStore'

/** Large chrome-bordered N logo matching the brand identity. */
function NadinLogo({ size = 80 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      fill="none"
      width={size}
      height={size}
      aria-label="Nadin"
    >
      <defs>
        {/* Navy body gradient — matches the deep navy in the logo */}
        <linearGradient id="lp-navy" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#253aaa" />
          <stop offset="100%" stopColor="#12205e" />
        </linearGradient>
        {/* Chrome / silver border — top-left highlight, bottom-right shadow */}
        <linearGradient id="lp-chrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#f0f4ff" />
          <stop offset="20%"  stopColor="#c8d4f0" />
          <stop offset="50%"  stopColor="#8898cc" />
          <stop offset="80%"  stopColor="#4a5ea8" />
          <stop offset="100%" stopColor="#303870" />
        </linearGradient>
        {/* Subtle inner highlight for 3-D depth */}
        <linearGradient id="lp-shine" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#4060d0" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0d1848" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ── Outer chrome N (creates the silver border) ───────────────── */}
      <path
        d="M8 112 L8 8 L36 8 L84 88 L84 8 L112 8 L112 112 L84 112 L36 32 L36 112 Z"
        fill="url(#lp-chrome)"
      />
      {/* ── Inner navy N body ─────────────────────────────────────────── */}
      <path
        d="M15 105 L15 15 L34 15 L82 95 L82 15 L105 15 L105 105 L83 105 L35 25 L35 105 Z"
        fill="url(#lp-navy)"
      />
      {/* ── Shine overlay for 3-D feel ────────────────────────────────── */}
      <path
        d="M15 15 L34 15 L82 95 L82 15 L105 15 L105 45 L60 15 Z"
        fill="url(#lp-shine)"
      />
    </svg>
  )
}

export function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Background — navy glow matching brand */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-900/25 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-800/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8">

          {/* Logo area */}
          <div className="flex flex-col items-center mb-8">
            <NadinLogo size={88} />
            <div className="mt-4 text-center">
              <h1 className="text-2xl font-bold text-white tracking-tight">Nadin</h1>
              <p className="text-xs text-gray-500 mt-0.5">Modular Dashboard Platform</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Sign in to your account</h2>
            <p className="text-sm text-gray-400 mt-1">Enter your credentials to continue</p>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-xs text-gray-600">
            Protected by end-to-end encryption and 2FA
          </p>
        </div>
      </div>
    </div>
  )
}
