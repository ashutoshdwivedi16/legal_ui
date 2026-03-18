import { usePermissionStore } from '../stores/permissionStore'

interface RequireRoleProps {
  role: string | string[]
  requireAll?: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RequireRole({
  role,
  requireAll = false,
  children,
  fallback = null,
}: RequireRoleProps) {
  const { hasRole, hasAnyRole, hasAllRoles } = usePermissionStore()

  const roles = Array.isArray(role) ? role : [role]

  const hasAccess =
    roles.length === 1
      ? hasRole(roles[0])
      : requireAll
        ? hasAllRoles(roles)
        : hasAnyRole(roles)

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
