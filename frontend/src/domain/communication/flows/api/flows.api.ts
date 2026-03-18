import apiClient from "@shared/lib/axios";

export type FlowStatus = "ACTIVE" | "DRAFT";

export type Flow = {
  flowId: number;
  name: string;
  description: string;
  status: FlowStatus;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
  executionAnalytics: {
    "totalFlowExecutions": number;
    "runningCount": number;
    "completedCount": number;
    "failedCount": number;
  }
};

export type GetFlowListResponse = {
  content: Flow[];
  totalPages: number;
  totalElements: number;
  last: boolean;
  size: number;
  number: number;
  sort: any[];
  numberOfElements: number;
  first: boolean;
  empty: boolean;
};

export type CreateFlowResponse = {
  createdAt: string;
  description: string;
  flowId: number;
  name: string;
  status: FlowStatus;
};

export type GetFlowDetailsResponse = {
  flowId: number;
  name: string;
  description: string;
  status: FlowStatus;
  latestVersion: {
    definition: {
      edge: any[];
      node: any[];
    }
  };
  nodeLastNumber: number;
};

export const getFlowList = async ({ page }: { page: number }): Promise<GetFlowListResponse> => {
  const response = await apiClient.get(`/communication/flows?size=20&page=${page - 1}`);
  return response.data;
};

export const getFlowDetails = async ({ flowId }: { flowId: string | number }): Promise<GetFlowDetailsResponse> => {
  const response = await apiClient.get(`/communication/flows/${flowId}`);
  return response.data;
};

export const createFlow = async ({ flowName, description, nodes, edges }: { flowName: string; description: string; nodes: unknown[]; edges: unknown[] }): Promise<CreateFlowResponse> => {
  const response = await apiClient.post("/communication/flows", {
    name: flowName,
    description,
    definition: { node: nodes, edge: edges },
  });
  return response.data;
};

export const updateFlow = async ({ flowId, flowName, description, nodes, edges }: { flowId: string | number; flowName: string; description: string; nodes: unknown[]; edges: unknown[] }): Promise<CreateFlowResponse> => {
  const response = await apiClient.put(`/communication/flows/${flowId}`, {
    name: flowName,
    description,
    definition: { node: nodes, edge: edges },
  });
  return response.data;
};

export const removeFlow = async (flowId: string | number): Promise<unknown> => {
  const response = await apiClient.delete(`/communication/flows/${flowId}/delete`);
  return response.data;
};

export const enableFlow = async ({ flowId, value }: { flowId: string | number; value: boolean }): Promise<unknown> => {
  const response = await apiClient.put(`/communication/flows/${flowId}/activate`, {
    value,
  });
  return response.data;
};

export interface EventSource {
  eventSourceId: string;
  eventSourceName: string;
}

export interface MetadataItem {
  eventId: string;
  eventName: string;
}

export interface EventGroup {
  eventGroupId: string;
  name: string;
}

export interface EventProperty {
  label: string;
  name: string;
  data_type: string;
}

export interface EventPropertiesResponse {
  eventProperties: EventProperty[];
}

export const getEventSources = async (): Promise<EventSource[]> => {
  const response = await apiClient.get("/communication/event-sources");
  return response.data;
};

export const getMetadata = async ({ eventSourceId }: { eventSourceId: string | number | undefined }): Promise<MetadataItem[]> => {
  const response = await apiClient.get(`/communication/events/metadata?eventSourceId=${ eventSourceId }`);
  return response.data;
};

export const getEventGroups = async (): Promise<EventGroup[]> => {
  const response = await apiClient.get("/communication/event-groups");
  return response.data;
};

export const getEventProperties = async ({ eventId }: { eventId: string | number | undefined }): Promise<EventPropertiesResponse> => {
  console.log("api request getEventProperties");
  const response = await apiClient.get(`/communication/events/${eventId}/properties`);
  return response.data;
};