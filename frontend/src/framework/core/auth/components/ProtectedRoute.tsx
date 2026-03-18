import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { usePermissionStore } from '../stores/permissionStore'
import { Loading } from '../../components/Loading'
import { AccessDenied } from '@shared/components/AccessDenied'
import { login } from '../login'
import { isEmbedMode } from '@shared/lib/embed'

interface ProtectedRouteProps {
  permissions?: string[]
  children?: React.ReactNode
}

export function ProtectedRoute({ permissions, children }: ProtectedRouteProps) {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuthStore()
  const { hasAnyPermission } = usePermissionStore()

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isEmbedMode()) {
      login.redirect(location.pathname)
    }
  }, [isLoading, isAuthenticated, location.pathname])

  if (isLoading) {
    return <Loading />
  }

  if (!isAuthenticated) {
    if (isEmbedMode()) {
      return <AccessDenied />
    }
    return <Loading />
  }

  if (permissions && permissions.length > 0 && !hasAnyPermission(permissions)) {
    return <AccessDenied />
  }

  return children ? <>{children}</> : <Outlet />
}
