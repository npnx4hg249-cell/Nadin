import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, CheckCircle, ArrowLeft, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

type Step = 'setup' | 'verify' | 'backup-codes'

export function SetupTwoFactorPage() {
  const navigate = useNavigate()
  const updateUser = useAuthStore((s) => s.updateUser)
  const [step, setStep] = useState<Step>('setup')
  const [verifyCode, setVerifyCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)

  const { data: setupData, isLoading } = useQuery({
    queryKey: ['2fa-setup'],
    queryFn: authApi.setup2fa,
    retry: false,
  })

  const confirmMutation = useMutation({
    mutationFn: (code: string) => authApi.confirm2faSetup(code),
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes)
      updateUser({ totp_enabled: true })
      setStep('backup-codes')
      toast.success('Two-factor authentication enabled!')
    },
    onError: () => {
      toast.error('Invalid verification code. Please try again.')
    },
  })

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} label="Setting up 2FA..." />
      </div>
    )
  }

  if (!setupData) {
    return (
      <div className="text-center py-16 text-gray-500">
        Failed to initialize 2FA setup. Please try again.
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <button
        onClick={() => navigate('/profile')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        Back to profile
      </button>

      {step === 'setup' && (
        <Card>
          <CardHeader
            title="Set up two-factor authentication"
            subtitle="Scan the QR code with your authenticator app"
          />

          <div className="space-y-6">
            {/* Step 1: QR Code */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">1</div>
                <p className="text-sm font-medium text-gray-200">Scan QR code</p>
              </div>
              <div className="flex justify-center p-6 bg-white rounded-xl">
                <QRCodeSVG
                  value={setupData.qr_uri}
                  size={192}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Manual key */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Can't scan? Enter this key manually:
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 font-mono text-xs bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-gray-300 select-all"
                  onClick={() => setKeyVisible(true)}
                >
                  {keyVisible ? setupData.secret : '••••••••••••••••••••••••••••••••'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setKeyVisible(true); handleCopy(setupData.secret) }}
                  icon={copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => setStep('verify')}
            >
              I've scanned the code — continue
            </Button>
          </div>
        </Card>
      )}

      {step === 'verify' && (
        <Card>
          <CardHeader
            title="Verify your authenticator"
            subtitle="Enter the 6-digit code from your authenticator app"
          />

          <div className="space-y-5">
            <div className="flex justify-center">
              <Shield size={48} className="text-blue-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full text-center text-2xl font-mono tracking-[0.5em] rounded-lg border border-gray-600 bg-gray-800 text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('setup')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                className="flex-1"
                loading={confirmMutation.isPending}
                disabled={verifyCode.length !== 6}
                onClick={() => confirmMutation.mutate(verifyCode)}
              >
                Enable 2FA
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 'backup-codes' && (
        <Card>
          <CardHeader
            title="Save your backup codes"
            subtitle="Store these codes securely. Each can be used once if you lose access to your authenticator."
          />

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <div
                  key={i}
                  className="font-mono text-sm text-center py-2 px-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200"
                >
                  {code}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full"
              icon={copied ? <CheckCircle size={16} /> : <Copy size={16} />}
              onClick={() => handleCopy(backupCodes.join('\n'))}
            >
              {copied ? 'Copied!' : 'Copy all codes'}
            </Button>

            <Button
              className="w-full"
              onClick={() => navigate('/profile')}
            >
              Done — go to profile
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
