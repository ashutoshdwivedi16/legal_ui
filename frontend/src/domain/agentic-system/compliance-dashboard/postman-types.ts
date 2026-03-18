// Postman-like HTTP Request Types

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key';

export interface AuthConfig {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyLocation?: 'header' | 'query';
}

export interface RequestConfig {
  id?: string | number;
  name?: string;
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  auth: AuthConfig;
  body?: string;
  bodyType?: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  time: number;
  size?: number;
}

export interface TestRequest {
  id: string | number;
  project_id: string | number;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  auth_config: AuthConfig;
  body?: string;
  body_type?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TestResult {
  id: string | number;
  request_id: string | number;
  status_code: number;
  response_headers: Record<string, string>;
  response_body: string;
  response_time_ms: number;
  executed_at: string;
}

// Default values
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  type: 'none',
};

export const DEFAULT_REQUEST_CONFIG: RequestConfig = {
  method: 'GET',
  url: '',
  headers: [],
  params: [],
  auth: DEFAULT_AUTH_CONFIG,
  body: '',
  bodyType: 'none',
};

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

export const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'api-key', label: 'API Key' },
];

export const BODY_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
  { value: 'raw', label: 'Raw' },
];
