import { Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from '@core/components/ErrorBoundary'
import { Loading } from '@core/components/Loading'
import { queryClient } from '@shared/lib/query-client'
import { AuthProvider } from '@core/auth'
import { ProtectedRoute } from '@core/auth/components/ProtectedRoute'
import { Toaster } from '@shared/components/ui/sonner'
import { loadModules, useMenuStore, useRouteStore } from '@core/navigation'
import { LoginPage, NotFoundPage, WelcomePage } from '@core/pages'
import { MainLayout } from '@core/layout/MainLayout'
import { FramelessLayout } from '@core/layout/FramelessLayout'
import { Dashboard } from '@core/pages/Dashboard'
import { useAuthStore } from '@core/auth/stores/authStore'
import { initEmbedMode, isEmbedMode } from '@shared/lib/embed'
import type { RouteConfig } from '@core/navigation'

const embedToken = initEmbedMode()
if (embedToken) {
  useAuthStore.getState().setAccessToken(embedToken)
}

const AppRoutes = () => {
  const dynamicRoutes = useRouteStore((state) => state.routes)
  const isRoutesLoaded = useRouteStore((state) => state.isLoaded)

  if (!isRoutesLoaded) {
    return <Loading />
  }

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Public routes - no auth, no layout */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/welcome" element={<WelcomePage />} />

        {/* Authenticated routes - with layout */}
        <Route element={isEmbedMode() ? <FramelessLayout /> : <MainLayout />}>
          {/* Auth-only routes (no specific permission needed) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          {/* Dynamic routes with their permissions */}
          {dynamicRoutes.map((route: RouteConfig) => (
            <Route
              key={route.path}
              element={<ProtectedRoute permissions={route.permissions} />}
            >
              <Route path={route.path} element={route.element} />
            </Route>
          ))}
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

const App = () => {
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initializeModules = async () => {
      try {
        const { menuItems, routes } = await loadModules()
        useMenuStore.getState().setMenuItems(menuItems)
        useRouteStore.getState().setRoutes(routes)
      } catch (error) {
        console.error('Failed to load modules:', error)
      } finally {
        setIsInitialized(true)
      }
    }
    initializeModules()
  }, [])

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
