import { Link } from 'react-router-dom'
import { Home, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-900/40 border border-blue-800 flex items-center justify-center mb-6">
        <Zap size={32} className="text-blue-400" />
      </div>
      <h1 className="text-7xl font-bold text-white tabular-nums">404</h1>
      <p className="mt-3 text-xl text-gray-300 font-medium">Page not found</p>
      <p className="mt-2 text-sm text-gray-500 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/dashboard" className="mt-8">
        <Button icon={<Home size={16} />} size="lg">
          Back to dashboard
        </Button>
      </Link>
    </div>
  )
}
