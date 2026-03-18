import apiClient from "@shared/lib/axios";

export type User = {
  id: number;
  externalUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  active: boolean;
  roles: RoleDto[];
  createdAt: string;
  updatedAt: string;
};

export type RoleDto = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
};

export type CreateUserRequest = {
  email: string;
  firstName?: string;
  lastName?: string;
  roleIds?: number[];
  temporaryPassword?: string;
};

export type UpdateUserRequest = {
  firstName?: string;
  lastName?: string;
  active?: boolean;
};

export type AssignRolesRequest = {
  roleIds: number[];
};

export type UserListParams = {
  page?: number;
  size?: number;
  status?: 'all' | 'active' | 'inactive';
  query?: string;
  sort?: string;
};

export type PageInfo = {
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

export type PagedResponse<T> = {
  success: boolean;
  data: T[];
  page: PageInfo;
};

export type DataResponse<T> = {
  success: boolean;
  data: T;
};

export const getUsers = async ({ page = 0, size = 10, status, query, sort }: UserListParams) => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('size', size.toString());
  if (status && status !== 'all') params.append('status', status);
  if (query) params.append('query', query);
  if (sort) params.append('sort', sort);

  const response = await apiClient.get<PagedResponse<User>>(`/users?${params.toString()}`);
  return {
    content: response.data.data,
    totalPages: response.data.page.totalPages,
    totalElements: response.data.page.totalElements,
    size: response.data.page.size,
    number: response.data.page.number,
  };
};

export const getUser = async (id: number | string) => {
  const response = await apiClient.get<DataResponse<User>>(`/users/${id}`);
  return response.data;
};

export const createUser = async (data: CreateUserRequest) => {
  const response = await apiClient.post<DataResponse<User>>('/users', data);
  return response.data;
};

export const updateUser = async ({ id, data }: { id: number | string; data: UpdateUserRequest }) => {
  const response = await apiClient.put<DataResponse<User>>(`/users/${id}`, data);
  return response.data;
};

export const deleteUser = async (id: number | string) => {
  await apiClient.delete(`/users/${id}`);
};

export const deleteUsers = async (ids: (number | string)[]) => {
  await Promise.all(ids.map(id => apiClient.delete(`/users/${id}`)));
  return ids;
};

export const assignRoles = async ({ id, data }: { id: number | string; data: AssignRolesRequest }) => {
  const response = await apiClient.put<DataResponse<User>>(`/users/${id}/roles`, data);
  return response.data;
};

export const getRoles = async () => {
  const response = await apiClient.get<DataResponse<RoleDto[]>>('/roles');
  return response.data;
};
