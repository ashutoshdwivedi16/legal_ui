import type { ReactNode } from 'react'
import { FileX, Search, AlertCircle, Plus } from 'lucide-react'
import { Button } from '@shared/components/ui/button'

type EmptyStateVariant = 'default' | 'search' | 'error'

interface EmptyStateProps {
  title: string
  description?: string
  variant?: EmptyStateVariant
  icon?: ReactNode
  action?: {
    label: string
    onClick: () => void
  }
}

const variantIcons: Record<EmptyStateVariant, ReactNode> = {
  default: <FileX className="h-12 w-12 text-muted-foreground" />,
  search: <Search className="h-12 w-12 text-muted-foreground" />,
  error: <AlertCircle className="h-12 w-12 text-destructive" />,
}

export function EmptyState({
  title,
  description,
  variant = 'default',
  icon,
  action,
}: EmptyStateProps) {
  const displayIcon = icon ?? variantIcons[variant]

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        {displayIcon}
      </div>
      <h3 className="mt-6 text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-6">
          <Plus className="mr-2 h-4 w-4" />
          {action.label}
        </Button>
      )}
    </div>
  )
}
