import apiClient from "@shared/lib/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";


export interface Permission {
  id: number;
  resource: string;
  action: string;
  permissionString: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDetail extends Role {
  permissions: Permission[];
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  isAdmin: boolean;
  permissionIds: number[];
}

export interface UpdateRoleRequest {
  name: string;
  description?: string;
  active: boolean;
  isAdmin: boolean;
  permissionIds: number[];
}

export interface PageInfo {
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface PageResponse<T> {
  success: boolean;
  data: T[];
  page: PageInfo;
}

export interface DataResponse<T> {
  success: boolean;
  data: T;
}


export const getRoles = async (params: { page?: number; size?: number; name?: string; active?: boolean; sort?: string }) => {
  const queryParams = new URLSearchParams();
  if (params.page !== undefined) queryParams.append('page', params.page.toString());
  if (params.size !== undefined) queryParams.append('size', params.size.toString());
  if (params.name) queryParams.append('name', params.name);
  if (params.active !== undefined) queryParams.append('active', params.active.toString());
  if (params.sort) {
    const [sortBy, sortDir] = params.sort.split(',');
    queryParams.append('sortBy', sortBy);
    queryParams.append('sortDir', sortDir?.toUpperCase() || 'ASC');
  }

  const response = await apiClient.get<PageResponse<RoleDetail>>(`/roles?${queryParams.toString()}`);
  return {
    content: response.data.data,
    totalPages: response.data.page.totalPages,
    totalElements: response.data.page.totalElements,
    size: response.data.page.size,
    number: response.data.page.number,
  };
};

export const getRole = async (id: number) => {
  const response = await apiClient.get<DataResponse<RoleDetail>>(`/roles/${id}`);
  return response.data.data;
};

export const getActiveRoles = async () => {
  const response = await apiClient.get<DataResponse<RoleDetail[]>>('/roles/active');
  return response.data.data;
};

export const createRole = async (data: CreateRoleRequest) => {
  const response = await apiClient.post<DataResponse<RoleDetail>>('/roles', data);
  return response.data.data;
};

export const updateRole = async ({ id, data }: { id: number; data: UpdateRoleRequest }) => {
  const response = await apiClient.put<DataResponse<RoleDetail>>(`/roles/${id}`, data);
  return response.data.data;
};

export const deleteRole = async (id: number) => {
  await apiClient.delete(`/roles/${id}`);
};


export const deleteRoles = async (ids: number[]) => {
  await Promise.all(ids.map(id => deleteRole(id)));
};

export const getPermissions = async () => {
  const response = await apiClient.get<DataResponse<Permission[]>>('/permissions/flat');
  return response.data.data;
};

export const useRolesQuery = (params: { page: number; size: number; name?: string; active?: boolean; sort?: string }) => {
  return useQuery({
    queryKey: ['roles', params],
    queryFn: () => getRoles(params),
    placeholderData: (prev) => prev,
  });
};

export const usePermissionsQuery = () => {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: getPermissions,
  });
};

export const useRoleQuery = (id: number) => {
  return useQuery({
    queryKey: ['roles', id],
    queryFn: () => getRole(id),
    enabled: !!id,
  });
};

export const useActiveRolesQuery = () => {
  return useQuery({
    queryKey: ['roles', 'active'],
    queryFn: getActiveRoles,
  });
};

export const useCreateRoleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
};

export const useUpdateRoleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateRole,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['roles', data.id] });
    },
  });
};

export const useDeleteRoleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
};

export const useDeleteRolesMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRoles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
};
