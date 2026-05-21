import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Shield } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

interface TwoFactorFormProps {
  email: string
}

export function TwoFactorForm({ email }: TwoFactorFormProps) {
  const { verify2fa } = useAuth()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all digits entered
    if (value && index === 5) {
      const full = [...newCode.slice(0, 5), value.slice(-1)].join('')
      if (full.length === 6) {
        handleSubmit(full)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const newCode = pasted.split('')
      setCode(newCode)
      inputRefs.current[5]?.focus()
      handleSubmit(pasted)
    }
  }

  const handleSubmit = async (fullCode?: string) => {
    const codeStr = fullCode || code.join('')
    if (codeStr.length !== 6) {
      toast.error('Please enter the 6-digit code')
      return
    }
    setIsSubmitting(true)
    try {
      await verify2fa(codeStr, email)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string }; status?: number } }
      if (error.response?.status === 401) {
        toast.error('Invalid verification code. Please try again.')
      } else if (error.response?.data?.detail) {
        toast.error(error.response.data.detail)
      } else {
        toast.error('Verification failed. Please try again.')
      }
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-full bg-blue-900/40 border border-blue-800 flex items-center justify-center">
          <Shield size={28} className="text-blue-400" />
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-400">
          Enter the 6-digit code from your authenticator app
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Signed in as <span className="text-gray-400">{email}</span>
        </p>
      </div>

      <div className="flex justify-center gap-2" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={isSubmitting}
            className="w-10 h-12 text-center text-lg font-mono font-semibold rounded-lg border bg-gray-800 text-white border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors disabled:opacity-50"
          />
        ))}
      </div>

      <Button
        onClick={() => handleSubmit()}
        loading={isSubmitting}
        className="w-full"
        size="lg"
        disabled={code.join('').length !== 6}
      >
        Verify
      </Button>
    </div>
  )
}
