import { useNavigate } from 'react-router-dom'
import { ShieldX, ArrowLeft, Home } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'

interface AccessDeniedProps {
  requiredPermission?: string
  title?: string
  description?: string
}

export function AccessDenied({
  requiredPermission,
  title = 'Access Denied',
  description = 'You do not have permission to access this resource.',
}: AccessDeniedProps) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ShieldX className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base mt-2">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requiredPermission && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium text-muted-foreground mb-2">Required Permission:</p>
              <code className="text-sm bg-background p-2 rounded inline-block w-full break-words">
                {requiredPermission}
              </code>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => navigate(-1)} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button onClick={() => navigate('/')} className="flex-1">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
