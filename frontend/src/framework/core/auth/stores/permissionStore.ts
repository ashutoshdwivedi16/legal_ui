import { create } from 'zustand'

interface PermissionState {
  roles: string[]
  permissions: string[]
}

interface PermissionActions {
  setPermissions: (roles: string[], permissions: string[]) => void
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
  hasAllRoles: (roles: string[]) => boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  clear: () => void
}

type PermissionStore = PermissionState & PermissionActions

function matchesWildcard(userPermission: string, requiredPermission: string): boolean {
  if (userPermission === requiredPermission) return true
  if (userPermission === '*') return true

  const userParts = userPermission.split(':')
  const requiredParts = requiredPermission.split(':')

  for (let i = 0; i < userParts.length; i++) {
    if (userParts[i] === '*') return true
    if (userParts[i] !== requiredParts[i]) return false
  }

  return userParts.length === requiredParts.length
}

export const usePermissionStore = create<PermissionStore>((set, get) => ({
  roles: [],
  permissions: [],

  setPermissions: (roles, permissions) => set({ roles, permissions }),

  hasRole: (role) => get().roles.includes(role),

  hasAnyRole: (roles) => roles.some((role) => get().roles.includes(role)),

  hasAllRoles: (roles) => roles.every((role) => get().roles.includes(role)),

  hasPermission: (permission) =>
    get().permissions.some((p) => matchesWildcard(p, permission)),

  hasAnyPermission: (permissions) =>
    permissions.some((permission) =>
      get().permissions.some((p) => matchesWildcard(p, permission))
    ),

  hasAllPermissions: (permissions) =>
    permissions.every((permission) =>
      get().permissions.some((p) => matchesWildcard(p, permission))
    ),

  clear: () => set({ roles: [], permissions: [] }),
}))
