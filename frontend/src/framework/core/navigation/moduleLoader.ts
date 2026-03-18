import type { MenuItem, RouteConfig, MenuModule, RoutesModule } from './types'

type GlobImport = Record<string, () => Promise<unknown>>

const frameworkMenuGlob: GlobImport = import.meta.glob(
  '/src/framework/domain/**/menu.tsx'
)
const frameworkRoutesGlob: GlobImport = import.meta.glob(
  '/src/framework/domain/**/routes.tsx'
)
const domainMenuGlob: GlobImport = import.meta.glob('/src/domain/**/menu.tsx')
const domainRoutesGlob: GlobImport = import.meta.glob(
  '/src/domain/**/routes.tsx'
)

const extractMenuFromModule = (mod: unknown): MenuItem | null => {
  const module = mod as MenuModule
  return module.default ?? module.menu ?? null
}

const extractRoutesFromModule = (mod: unknown): RouteConfig[] => {
  const module = mod as RoutesModule
  return module.default ?? module.routes ?? []
}

const buildMenuHierarchy = (menus: MenuItem[]): MenuItem[] => {
  const menuMap = new Map<string, MenuItem>()
  const rootMenus: MenuItem[] = []

  for (const menu of menus) {
    menuMap.set(menu.id, { ...menu })
  }

  for (const menu of menus) {
    const parts = menu.id.split('/')
    if (parts.length === 1) {
      rootMenus.push(menuMap.get(menu.id)!)
    } else {
      const parentId = parts.slice(0, -1).join('/')
      const parent = menuMap.get(parentId)
      if (parent) {
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(menuMap.get(menu.id)!)
      } else {
        rootMenus.push(menuMap.get(menu.id)!)
      }
    }
  }

  return rootMenus
}

interface LoadedModules {
  menuItems: MenuItem[]
  routes: RouteConfig[]
}

const loadMenusFromGlob = async (
  glob: GlobImport
): Promise<MenuItem[]> => {
  const menuPromises = Object.entries(glob).map(
    async ([path, loader]) => {
      try {
        const module = await loader()
        const menu = extractMenuFromModule(module)
        if (menu) {
          return menu
        }
        console.warn(`No menu export found in ${path}`)
        return null
      } catch (error) {
        console.error(`Failed to load menu from ${path}:`, error)
        return null
      }
    }
  )
  const results = await Promise.all(menuPromises)
  return results.filter((m): m is MenuItem => m !== null)
}

const loadRoutesFromGlob = async (
  glob: GlobImport
): Promise<RouteConfig[]> => {
  const routePromises = Object.entries(glob).map(
    async ([path, loader]) => {
      try {
        const module = await loader()
        return extractRoutesFromModule(module)
      } catch (error) {
        console.error(`Failed to load routes from ${path}:`, error)
        return []
      }
    }
  )
  const results = await Promise.all(routePromises)
  return results.flat()
}

export const loadModules = async (): Promise<LoadedModules> => {
  const [domainMenus, frameworkMenus, domainRoutes, frameworkRoutes] = await Promise.all([
    loadMenusFromGlob(domainMenuGlob),
    loadMenusFromGlob(frameworkMenuGlob),
    loadRoutesFromGlob(domainRoutesGlob),
    loadRoutesFromGlob(frameworkRoutesGlob),
  ])

  const domainHierarchy = buildMenuHierarchy(domainMenus)
  const frameworkHierarchy = buildMenuHierarchy(frameworkMenus)

  const menuItems = [...domainHierarchy, ...frameworkHierarchy]
  const routes = [...domainRoutes, ...frameworkRoutes]

  return { menuItems, routes }
}
