import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/components/ui/button'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="text-muted-foreground">Page not found</p>
        <Button onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    </div>
  )
}
