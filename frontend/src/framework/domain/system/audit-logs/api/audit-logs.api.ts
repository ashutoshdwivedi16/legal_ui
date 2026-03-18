import apiClient from "@shared/lib/axios";

export type AuditLog = {
  id: number;
  timestamp: string;
  userId: number | null;
  userEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: number | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  errorMessage: string | null;
  serviceName: string | null;
  endpoint: string | null;
  httpMethod: string | null;
  correlationId: string | null;
};

export type AuditLogListParams = {
  page?: number;
  size?: number;
  sort?: string;
  userEmail?: string;
  action?: string;
  resourceType?: string;
  serviceName?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
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

export const getAuditLogs = async (params: AuditLogListParams = {}) => {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) searchParams.append("page", params.page.toString());
  if (params.size !== undefined) searchParams.append("size", params.size.toString());
  if (params.sort) searchParams.append("sort", params.sort);
  if (params.userEmail) searchParams.append("userEmail", params.userEmail);
  if (params.action) searchParams.append("action", params.action);
  if (params.resourceType) searchParams.append("resourceType", params.resourceType);
  if (params.serviceName) searchParams.append("serviceName", params.serviceName);
  if (params.success !== undefined) searchParams.append("success", params.success.toString());
  if (params.startDate) searchParams.append("startDate", params.startDate);
  if (params.endDate) searchParams.append("endDate", params.endDate);

  const response = await apiClient.get<PagedResponse<AuditLog>>(`/audit-logs?${searchParams.toString()}`);
  return {
    content: response.data.data,
    totalPages: response.data.page.totalPages,
    totalElements: response.data.page.totalElements,
    size: response.data.page.size,
    number: response.data.page.number,
  };
};

export const getAuditLog = async (id: number | string) => {
  const response = await apiClient.get<DataResponse<AuditLog>>(`/audit-logs/${id}`);
  return response.data.data;
};

export const exportAuditLogs = async (params: AuditLogListParams = {}) => {
  const searchParams = new URLSearchParams();
  if (params.userEmail) searchParams.append("userEmail", params.userEmail);
  if (params.action) searchParams.append("action", params.action);
  if (params.resourceType) searchParams.append("resourceType", params.resourceType);
  if (params.serviceName) searchParams.append("serviceName", params.serviceName);
  if (params.success !== undefined) searchParams.append("success", params.success.toString());
  if (params.startDate) searchParams.append("startDate", params.startDate);
  if (params.endDate) searchParams.append("endDate", params.endDate);

  const response = await apiClient.get<DataResponse<AuditLog[]>>(`/audit-logs/export?${searchParams.toString()}`);
  return response.data.data;
};
