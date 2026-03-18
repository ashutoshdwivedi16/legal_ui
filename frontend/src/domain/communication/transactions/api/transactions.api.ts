import apiClient from "@shared/lib/axios";
import type { GetFlowDetailsResponse } from "../../flows/api/flows.api";

export type TransactionStatus = "IN_PROGRESS" | "COMPLETE";

export type Transaction = {
  flowExecutionId: number;
  flowId: number;
  flowVersionId: number;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
};

export type GetTransactionListResponse = {
  content: Transaction[];
  totalPages: number;
  totalElements: number;
  last: boolean;
  size: number;
  number: number;
  sort: unknown[];
  numberOfElements: number;
  first: boolean;
  empty: boolean;
};

export type GetTransactionDetailsResponse = {
  transactionId: number;
  transactionName: string;
  nodes: unknown[];
  edges: unknown[];
};

export const getTransactionList = async ({ flowId = "", eventGroupId = "", sort = "", page = 1 }: { flowId?: string; eventGroupId?: string; sort?: string; page?: number }): Promise<GetTransactionListResponse> => {
  console.log("debug api request getTransactionList", flowId, eventGroupId);
  const response = await apiClient.get(`/communication/flow-executions?size=20&page=${page - 1}&sort=${sort}&event_group_id=${eventGroupId}&flow_id=${flowId}`);
  return response.data;
};

export type getTransactionAnalyticsResponse = {
  "totalFlowExecutions": number;
  "runningCount": number;
  "completedCount": number;
  "failedCount": number;
};

export const getTransactionAnalytics = async ({ flowId = "", eventGroupId = "" }: { flowId?: string; eventGroupId?: string }): Promise<getTransactionAnalyticsResponse> => {
  console.log("debug api request getTransactionList", flowId, eventGroupId);
  const response = await apiClient.get(`/communication/flow-executions/analytics?event_group_id=${eventGroupId}&flow_id=${flowId}`);
  return response.data;
};

export const getTransactionDetails = async ({ flowId }: { flowId: string | number }): Promise<GetFlowDetailsResponse> => {
  const response = await apiClient.get(`/communication/flows/${flowId}`);
  return response.data;
};