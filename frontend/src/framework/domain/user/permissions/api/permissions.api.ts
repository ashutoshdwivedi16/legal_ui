import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/shared/lib/axios';

export interface Permission {
  id: number;
  resource: string;
  action: string;
  permissionString: string;
}

export interface PermissionTree {
  resource: string;
  permissions: Permission[];
}

export interface PermissionSyncResult {
  added: number;
  removed: number;
  unchanged: number;
  addedPermissions: Permission[];
  removedPermissions: Permission[];
}

interface DataResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const getPermissionTree = async () => {
  const response = await apiClient.get<DataResponse<PermissionTree[]>>('/permissions');
  return response.data;
};

export const getAllPermissions = async () => {
  const response = await apiClient.get<DataResponse<Permission[]>>('/permissions/flat');
  return response.data;
};

export const syncPermissions = async () => {
  const response = await apiClient.post<DataResponse<PermissionSyncResult>>('/permissions/sync');
  return response.data;
};

export const usePermissionTreeQuery = () => {
  return useQuery({
    queryKey: ['permissions', 'tree'],
    queryFn: getPermissionTree,
  });
};

export const useAllPermissionsQuery = () => {
  return useQuery({
    queryKey: ['permissions', 'flat'],
    queryFn: getAllPermissions,
  });
};

export const useSyncPermissionsMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: syncPermissions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
};
