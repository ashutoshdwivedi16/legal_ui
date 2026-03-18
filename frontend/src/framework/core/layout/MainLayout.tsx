import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@shared/components/ui/sidebar'
import { Separator } from '@shared/components/ui/separator'
import { AppSidebar } from './components/AppSidebar'
import { Breadcrumbs } from './components/Breadcrumb'

interface MainLayoutProps {
  children?: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="h-screen bg-background">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="h-full overflow-y-auto flex flex-col">
            <div className="flex items-center py-4 h-12">
              <div className="px-2">
                <SidebarTrigger />
              </div>
              <Separator orientation="vertical" />
              <div className="px-4">
                <Breadcrumbs />
              </div>
            </div>
            <Separator />
            <div className="flex-1 p-8">
              {children ?? <Outlet />}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
