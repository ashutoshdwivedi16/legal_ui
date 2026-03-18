import { useEffect, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { usePermissionStore } from '../stores/permissionStore'
import { Loading } from '../../components/Loading'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { checkAuth, isLoading, user, isAuthenticated } = useAuthStore()
  const { setPermissions } = usePermissionStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (user) {
      setPermissions(user.roles ?? [], user.permissions ?? [])
    }
  }, [user, setPermissions])

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const returnTo = sessionStorage.getItem('auth_return_to')
      if (returnTo) {
        sessionStorage.removeItem('auth_return_to')
        if (location.pathname !== returnTo) {
          navigate(returnTo, { replace: true })
        }
      }
    }
  }, [isAuthenticated, isLoading, navigate, location.pathname])

  if (isLoading) {
    return <Loading />
  }

  return <>{children}</>
}
