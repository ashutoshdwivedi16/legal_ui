export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  roles: string[]
  permissions: string[]
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
  error: string | null
}
