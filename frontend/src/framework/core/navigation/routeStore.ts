import { create } from 'zustand'
import type { RouteConfig } from './types'

interface RouteState {
  routes: RouteConfig[]
  isLoaded: boolean
}

interface RouteActions {
  setRoutes: (routes: RouteConfig[]) => void
  getRoutes: () => RouteConfig[]
}

type RouteStore = RouteState & RouteActions

export const useRouteStore = create<RouteStore>((set, get) => ({
  routes: [],
  isLoaded: false,

  setRoutes: (routes: RouteConfig[]) => {
    set({
      routes,
      isLoaded: true,
    })
  },

  getRoutes: (): RouteConfig[] => {
    return get().routes
  },
}))
