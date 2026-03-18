import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@shared/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  className?: string
}

const routeLabels: Record<string, string> = {
  '': 'Dashboard',
  admin: 'Admin',
  users: 'Users',
  roles: 'Roles',
  permissions: 'Permissions',
  'audit-logs': 'Audit Logs',
  profile: 'Profile',
  new: 'Create',
  edit: 'Edit',
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const location = useLocation()

  const breadcrumbItems: BreadcrumbItem[] = items ?? generateBreadcrumbs(location.pathname)

  if (breadcrumbItems.length <= 1) {
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4', className)}>
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        <li>
          <Link
            to="/"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
          </Link>
        </li>
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4" />
            {item.href && index < breadcrumbItems.length - 1 ? (
              <Link to={item.href} className="hover:text-foreground transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const items: BreadcrumbItem[] = []

  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    const label = routeLabels[segment] ?? formatSegment(segment)
    items.push({ label, href: currentPath })
  }

  return items
}

function formatSegment(segment: string): string {
  if (/^[0-9a-f-]{36}$/i.test(segment)) {
    return 'Details'
  }
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
