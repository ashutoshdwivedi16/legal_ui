import apiClient from "@shared/lib/axios";

export type SampleItemStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ARCHIVED';

export type SampleItem = {
  id: number;
  name: string;
  description: string;
  status: SampleItemStatus;
  createdAt: string;
  updatedAt: string;
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

export type GetSampleItemsParams = {
  page?: number;
  size?: number;
  status?: string;
  query?: string;
  sort?: string;
};

export const getSampleItems = async ({ page = 0, size = 10, status, query, sort }: GetSampleItemsParams) => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('size', size.toString());
  if (status && status !== 'all') params.append('status', status);
  if (query) params.append('query', query);
  if (sort) params.append('sort', sort);

  const response = await apiClient.get<PagedResponse<SampleItem>>(`/sample/items?${params.toString()}`);
  return {
    content: response.data.data,
    totalPages: response.data.page.totalPages,
    totalElements: response.data.page.totalElements,
    size: response.data.page.size,
    number: response.data.page.number,
  };
};

export const getSampleItem = async (id: number | string) => {
  const response = await apiClient.get<DataResponse<SampleItem>>(`/sample/items/${id}`);
  return response.data;
};

export const createSampleItem = async (data: Partial<SampleItem>) => {
  const response = await apiClient.post<DataResponse<SampleItem>>('/sample/items', data);
  return response.data;
};

export const updateSampleItem = async ({ id, data }: { id: number | string; data: Partial<SampleItem> }) => {
  const response = await apiClient.put<DataResponse<SampleItem>>(`/sample/items/${id}`, data);
  return response.data;
};

export const deleteSampleItem = async (id: number | string) => {
  await apiClient.delete(`/sample/items/${id}`);
};

export const deleteSampleItems = async (ids: (number | string)[]) => {
  await apiClient.delete('/sample/items', { data: { ids } });
};
