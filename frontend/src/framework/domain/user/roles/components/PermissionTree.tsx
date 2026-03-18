import { useMemo } from 'react';
import { Button } from '@shared/components/ui/button';
import { Checkbox } from '@shared/components/ui/checkbox';
import { Badge } from '@shared/components/ui/badge';
import type { Permission } from '../api/roles.api';

interface PermissionTreeProps {
  permissions: Permission[];
  selectedIds?: number[];
  onChange?: (ids: number[]) => void;
  readOnly?: boolean;
  displayOnly?: boolean;
}

export function PermissionTree({ permissions, selectedIds = [], onChange, readOnly, displayOnly }: PermissionTreeProps) {
  const groupedPermissions = useMemo(() => {
    return permissions.reduce((acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [permissions]);

  const selectAll = () => {
    onChange?.(permissions.map(p => p.id));
  };

  const deselectAll = () => {
    onChange?.([]);
  };

  const toggleResource = (resource: string) => {
    const resourcePerms = groupedPermissions[resource];
    const resourcePermIds = resourcePerms.map(p => p.id);
    const allSelected = resourcePermIds.every(id => selectedIds.includes(id));

    if (allSelected) {
      onChange?.(selectedIds.filter(id => !resourcePermIds.includes(id)));
    } else {
      const newSelectedIds = [...selectedIds];
      resourcePermIds.forEach(id => {
        if (!newSelectedIds.includes(id)) {
          newSelectedIds.push(id);
        }
      });
      onChange?.(newSelectedIds);
    }
  };

  const togglePermission = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange?.(selectedIds.filter(sid => sid !== id));
    } else {
      onChange?.([...selectedIds, id]);
    }
  };

  const isAllSelected = (perms: Permission[]) => {
    return perms.every(p => selectedIds.includes(p.id));
  };

  const isSomeSelected = (perms: Permission[]) => {
    const selectedCount = perms.filter(p => selectedIds.includes(p.id)).length;
    return selectedCount > 0 && selectedCount < perms.length;
  };

  if (displayOnly) {
    return (
      <div className="space-y-4">
        {Object.entries(groupedPermissions).map(([resource, perms]) => (
          <div key={resource} className="border rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">{resource}</h3>
            <div className="flex flex-wrap gap-2">
              {perms.map(perm => (
                <Badge key={perm.id} variant="secondary" className="text-xs">
                  {perm.action}
                  <span className="text-muted-foreground ml-1">({perm.permissionString})</span>
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isDisabled = readOnly;

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAll} disabled={isDisabled}>Select All</Button>
          <Button type="button" variant="outline" size="sm" onClick={deselectAll} disabled={isDisabled}>Deselect All</Button>
        </div>
      )}
      
      {Object.entries(groupedPermissions).map(([resource, perms]) => (
        <div key={resource} className="border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Checkbox
              id={`resource-${resource}`}
              checked={isAllSelected(perms) ? true : (isSomeSelected(perms) ? 'indeterminate' : false)}
              onCheckedChange={() => toggleResource(resource)}
              disabled={isDisabled}
            />
            <label
              htmlFor={`resource-${resource}`}
              className="font-semibold text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {resource}
            </label>
          </div>
          
          <div className="ml-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {perms.map(perm => (
              <div key={perm.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`perm-${perm.id}`}
                  checked={selectedIds.includes(perm.id)}
                  onCheckedChange={() => togglePermission(perm.id)}
                  disabled={isDisabled}
                />
                <label
                  htmlFor={`perm-${perm.id}`}
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {perm.action} <span className="text-muted-foreground">({perm.permissionString})</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
