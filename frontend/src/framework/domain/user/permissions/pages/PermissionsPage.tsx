import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@shared/components/ui/spinner';
import { PermissionTree } from '../../roles/components/PermissionTree';
import { useAllPermissionsQuery, useSyncPermissionsMutation } from '../api/permissions.api';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function PermissionsPage() {
  const { data: permissionsData, isLoading } = useAllPermissionsQuery();
  const syncMutation = useSyncPermissionsMutation();
  
  const handleSync = async () => {
    try {
      const response = await syncMutation.mutateAsync();
      const result = response.data;
      
      toast.success(`Permissions synchronized: Added ${result.added}, Removed ${result.removed}, Unchanged ${result.unchanged}`);
    } catch (error) {
      toast.error(`Sync failed: ${(error as Error).message}`);
    }
  };
  
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Permissions</h1>
          <Button disabled>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Permissions
          </Button>
        </div>
        <div className="flex justify-center items-center flex-1">
          <Spinner className="text-primary size-10" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Permissions</h1>
        <Button onClick={handleSync} disabled={syncMutation.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          Sync Permissions
        </Button>
      </div>
      
      <div className="rounded-md border p-6">
        <PermissionTree
          permissions={permissionsData?.data || []}
          displayOnly={true}
        />
      </div>
    </div>
  );
}
