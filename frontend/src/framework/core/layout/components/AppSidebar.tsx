import { NavLink, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@shared/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/components/ui/collapsible'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@shared/components/ui/avatar'
import { ChevronDown, ChevronsUpDown, Home, Circle, LogOut, User } from 'lucide-react'
import { useMenuStore } from '../../navigation/menuStore'
import { usePermissionStore } from '../../auth/stores/permissionStore'
import { useAuthStore } from '../../auth/stores/authStore'
import type { MenuItem } from '../../navigation/types'

function isPathInMenuItem(pathname: string, item: MenuItem): boolean {
  if (item.path && (pathname === item.path || pathname.startsWith(item.path + '/'))) {
    return true
  }
  if (item.children) {
    return item.children.some(child => isPathInMenuItem(pathname, child))
  }
  return false
}

function RecursiveMenuSubItem({ item, pathname }: { item: MenuItem; pathname: string }) {
  const hasChildren = item.children && item.children.length > 0
  
  if (hasChildren) {
    const shouldExpand = isPathInMenuItem(pathname, item)
    return (
      <Collapsible defaultOpen={shouldExpand} className="group/nested">
        <SidebarMenuSubItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton>
              <span>{item.label}</span>
              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/nested:rotate-180" />
            </SidebarMenuSubButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children?.map((child) => (
                <RecursiveMenuSubItem key={child.id} item={child} pathname={pathname} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuSubItem>
      </Collapsible>
    )
  }
  
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={pathname === item.path || pathname.startsWith(item.path + '/')}>
        <NavLink to={item.path!}>
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

const coreMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: Home, order: 0 },
]

export function AppSidebar() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { isMobile } = useSidebar()
  const { hasPermission, permissions } = usePermissionStore()
  const menuItems = useMenuStore((state) => state.menuItems)
  const isMenuLoaded = useMenuStore((state) => state.isLoaded)
  const getFilteredMenu = useMenuStore((state) => state.getFilteredMenu)

  const visibleItems = useMemo(() => {
    const dashboard = coreMenuItems[0]
    if (isMenuLoaded && menuItems.length > 0) {
      return [dashboard, ...getFilteredMenu(permissions)]
    }
    return coreMenuItems.filter(
      item => !item.permissions || item.permissions.some(p => hasPermission(p))
    )
  }, [menuItems, isMenuLoaded, permissions, hasPermission, getFilteredMenu])

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }
  
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex justify-center">
        <div className="flex items-center gap-2 overflow-x-hidden">
          <img
            src="/lg-favicon.ico"
            alt="LG"
            className="h-8 w-8 object-cover"
          />
          <div>
            <h2 className="whitespace-nowrap font-semibold">LG Admin</h2>
            <p className="whitespace-nowrap text-sm text-muted-foreground">Admin Panel</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon || Circle
                const hasChildren = item.children && item.children.length > 0
                
                if (hasChildren) {
                  const shouldExpand = isPathInMenuItem(location.pathname, item)
                  return (
                    <Collapsible key={item.id} defaultOpen={shouldExpand} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.label}>
                            <Icon />
                            <span>{item.label}</span>
                            <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children?.map((child) => (
                              <RecursiveMenuSubItem key={child.id} item={child} pathname={location.pathname} />
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                }
                
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.path} tooltip={item.label}>
                      <NavLink to={item.path!}>
                        <Icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={user?.email} />
                    <AvatarFallback className="bg-red-700 text-white">
                      {user?.firstName && user?.lastName
                        ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                        : user?.email?.substring(0, 2).toUpperCase() || 'AD'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : user?.email?.split('@')[0] || 'User'}
                  </span>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={() => window.location.href = '/profile'}>
                  <User className="mr-2 h-4 w-4" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
