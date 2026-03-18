import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert'

interface ServerErrorProps {
  message?: string
}

export function ServerError({ message }: ServerErrorProps) {
  return (
    <Alert variant="destructive" className="max-w-lg mx-auto mt-8">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {message || 'Something went wrong. Please try again later.'}
      </AlertDescription>
    </Alert>
  )
}
