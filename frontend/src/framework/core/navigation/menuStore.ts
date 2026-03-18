import { create } from 'zustand'
import type { MenuItem } from './types'

interface MenuState {
  menuItems: MenuItem[]
  isLoaded: boolean
}

interface MenuActions {
  setMenuItems: (items: MenuItem[]) => void
  getFilteredMenu: (userPermissions: string[]) => MenuItem[]
}

type MenuStore = MenuState & MenuActions

const sortMenuItems = (items: MenuItem[]): MenuItem[] => {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      ...item,
      children: item.children ? sortMenuItems(item.children) : undefined,
    }))
}

const filterByPermissions = (
  items: MenuItem[],
  userPermissions: string[]
): MenuItem[] => {
  return items
    .filter((item) => {
      if (!item.permissions || item.permissions.length === 0) {
        return true
      }
      return item.permissions.some((perm) => userPermissions.includes(perm))
    })
    .map((item) => ({
      ...item,
      children: item.children
        ? filterByPermissions(item.children, userPermissions)
        : undefined,
    }))
    .filter((item) => {
      if (item.path) return true
      if (item.children && item.children.length > 0) return true
      return false
    })
}

export const useMenuStore = create<MenuStore>((set, get) => ({
  menuItems: [],
  isLoaded: false,

  setMenuItems: (items: MenuItem[]) => {
    set({
      menuItems: sortMenuItems(items),
      isLoaded: true,
    })
  },

  getFilteredMenu: (userPermissions: string[]): MenuItem[] => {
    const { menuItems } = get()
    return filterByPermissions(menuItems, userPermissions)
  },
}))
