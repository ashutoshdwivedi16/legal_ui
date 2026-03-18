import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@shared/components/ui/breadcrumb"
import { useLocation, Link } from "react-router-dom"
import React, { useMemo } from 'react'
import { useRouteStore } from '../../navigation/routeStore'

export function Breadcrumbs() {
  const location = useLocation()
  const routes = useRouteStore((state) => state.routes)
  
  const definedPaths = useMemo(() => {
    const paths = new Set<string>(['/'])
    routes.forEach((route) => {
      if (route.path && !route.path.includes(':')) {
        paths.add(route.path)
      }
    })
    return paths
  }, [routes])
  
  const path = location.pathname
  const pathArray = path.split("/").filter(Boolean)
  
  if (pathArray.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        
        {pathArray.map((segment, index) => {
          const isLast = index === pathArray.length - 1
          const href = `/${pathArray.slice(0, index + 1).join("/")}`
          const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
          const hasRoute = definedPaths.has(href)
          
          return (
            <React.Fragment key={href}>
              <BreadcrumbItem>
                {isLast || !hasRoute ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
