import { Link } from 'react-router-dom'
import { BarChart3, Home } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-center">
      <BarChart3 className="mb-4 h-12 w-12 text-blue-400" />
      <h1 className="text-6xl font-bold text-white">404</h1>
      <p className="mt-2 text-xl text-gray-400">Page not found</p>
      <p className="mt-1 text-sm text-gray-500">The page you're looking for doesn't exist.</p>
      <Button asChild className="mt-6 gap-2">
        <Link to="/">
          <Home className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </Button>
    </div>
  )
}
