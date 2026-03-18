import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { login } from '../auth/login'

export function WelcomePage() {
  const handleSignIn = () => {
    login.redirect('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Admin Portal</CardTitle>
          <CardDescription>
            Universal Admin Framework
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            This is a secure administration portal. Please sign in to access the dashboard and manage your resources.
          </p>
          <Button onClick={handleSignIn} className="w-full" size="lg">
            Sign In
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account? Contact your administrator to request access.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
