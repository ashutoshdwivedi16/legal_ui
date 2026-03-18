import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Textarea } from '@shared/components/ui/textarea';
import { Switch } from '@shared/components/ui/switch';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Spinner } from '@shared/components/ui/spinner';
import { useRoleQuery, useCreateRoleMutation, useUpdateRoleMutation, usePermissionsQuery } from '../api/roles.api';
import { PermissionTree } from '../components/PermissionTree';
import { usePermissionStore } from '@core/auth/stores/permissionStore';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  active: z.boolean().default(true),
  isAdmin: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface RoleFormProps {
  mode: 'create' | 'edit' | 'view';
}

export default function RoleForm({ mode }: RoleFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const roleId = id ? parseInt(id) : 0;
  
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);

  const { hasPermission } = usePermissionStore();
  const canUpdate = hasPermission('admin.roles:update');

  const { data: roleData, isLoading: isRoleLoading } = useRoleQuery(roleId);
  const { data: permissions, isLoading: isPermissionsLoading } = usePermissionsQuery();
  
  const createRoleMutation = useCreateRoleMutation();
  const updateRoleMutation = useUpdateRoleMutation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      active: true,
      isAdmin: false,
    },
  });

  const isAdmin = form.watch('isAdmin');

  const handleIsAdminChange = (checked: boolean) => {
    form.setValue('isAdmin', checked);
    if (checked && permissions) {
      setSelectedPermissionIds(permissions.map(p => p.id));
    }
  };

  useEffect(() => {
    if (mode !== 'create' && roleData) {
      form.reset({
        name: roleData.name,
        description: roleData.description || '',
        active: roleData.active,
        isAdmin: roleData.isAdmin,
      });
      if (roleData.isAdmin && permissions) {
        setSelectedPermissionIds(permissions.map(p => p.id));
      } else {
        setSelectedPermissionIds(roleData.permissions.map(p => p.id));
      }
    }
  }, [mode, roleData, permissions, form]);

  const handleSubmit = async (values: FormValues) => {
    try {
      const request = {
        ...values,
        permissionIds: selectedPermissionIds,
      };

      if (mode === 'create') {
        await createRoleMutation.mutateAsync(request);
        toast.success('Role created successfully');
      } else {
        await updateRoleMutation.mutateAsync({ id: roleId, data: request });
        toast.success('Role updated successfully');
      }
      navigate('/user/roles');
    } catch (error) {
      toast.error('Failed to save role');
    }
  };

  if ((mode !== 'create' && isRoleLoading) || isPermissionsLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner className="size-10" />
      </div>
    );
  }

  const isReadOnly = mode === 'view';

  const getTitle = () => {
    if (mode === 'view') return 'View Role';
    if (mode === 'edit') return 'Edit Role';
    return 'Create Role';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{getTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isReadOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={isReadOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Role availability in the system
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isReadOnly}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isAdmin"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 border-destructive/50 bg-destructive/5">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base text-destructive">Administrator Access</FormLabel>
                      <FormDescription className="text-destructive/80">
                        Grants full system access. Use with caution.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={handleIsAdminChange}
                        disabled={isReadOnly}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <h3 className="text-base font-medium">Permissions</h3>
                  {isAdmin && (
                    <p className="text-sm text-muted-foreground">
                      Administrator role has full access to all permissions.
                    </p>
                  )}
                </div>
                {isReadOnly ? (
                  isAdmin && permissions ? (
                    <PermissionTree
                      permissions={permissions}
                      displayOnly={true}
                    />
                  ) : roleData?.permissions && roleData.permissions.length > 0 ? (
                    <PermissionTree
                      permissions={roleData.permissions}
                      displayOnly={true}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No permissions assigned to this role.</p>
                  )
                ) : (
                  permissions ? (
                    <PermissionTree
                      permissions={permissions}
                      selectedIds={selectedPermissionIds}
                      onChange={setSelectedPermissionIds}
                      readOnly={isAdmin}
                    />
                  ) : (
                    <div>No permissions available</div>
                  )
                )}
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/user/roles')}
                >
                  {isReadOnly ? "Back to List" : "Cancel"}
                </Button>
                {isReadOnly ? (
                  canUpdate && (
                    <Button type="button" onClick={() => navigate(`/user/roles/${roleId}/edit`)}>
                      Edit
                    </Button>
                  )
                ) : (
                  <Button type="submit" disabled={createRoleMutation.isPending || updateRoleMutation.isPending}>
                    {(createRoleMutation.isPending || updateRoleMutation.isPending) && <Spinner className="mr-2 h-4 w-4" />}
                    {mode === 'edit' ? 'Update Role' : 'Create Role'}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
