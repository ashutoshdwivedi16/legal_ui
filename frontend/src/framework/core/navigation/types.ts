import type { ComponentType, ReactNode } from 'react'

/**
 * MenuItem represents a single entry in the navigation menu.
 * Supports nested children for hierarchical menus up to 3 levels deep.
 */
export interface MenuItem {
  /** Unique identifier for the menu item */
  id: string
  /** Display label for the menu item */
  label: string
  /** Icon component to display */
  icon?: ComponentType<{ className?: string }>
  /** Navigation path (leaf nodes only) */
  path?: string
  /** Sort order (lower = higher priority) */
  order: number
  /** Required permissions to view this menu item */
  permissions?: string[]
  /** Child menu items for nested menus */
  children?: MenuItem[]
}

/**
 * RouteConfig defines a single route in the application.
 */
export interface RouteConfig {
  /** Route path pattern */
  path: string
  /** React element to render */
  element: ReactNode
  /** Required permissions to access this route */
  permissions?: string[]
}

/**
 * ModuleManifest is the structure exported by each module's menu.tsx file.
 * Contains both menu configuration and route definitions.
 */
export interface ModuleManifest {
  /** Menu configuration for this module */
  menu: MenuItem
  /** Routes provided by this module */
  routes: RouteConfig[]
}

/**
 * MenuModule represents a dynamically imported menu.tsx file.
 */
export interface MenuModule {
  default?: MenuItem
  menu?: MenuItem
}

/**
 * RoutesModule represents a dynamically imported routes.tsx file.
 */
export interface RoutesModule {
  default?: RouteConfig[]
  routes?: RouteConfig[]
}
