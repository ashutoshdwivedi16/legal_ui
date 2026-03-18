import { usePermissionStore } from '../stores/permissionStore'

interface RequirePermissionProps {
  permission: string | string[]
  requireAll?: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RequirePermission({
  permission,
  requireAll = false,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissionStore()

  const permissions = Array.isArray(permission) ? permission : [permission]

  const hasAccess =
    permissions.length === 1
      ? hasPermission(permissions[0])
      : requireAll
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions)

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
