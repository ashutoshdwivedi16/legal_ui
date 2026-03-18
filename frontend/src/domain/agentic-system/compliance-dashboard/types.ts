import type { DataSource } from "./DataSourceEditor";

export type AuditTest = {
  testName: string;
  status: "passed" | "failed";
  errorMessage?: string | null;
};

export type AuditRun = {
  id: string | number;
  passed: number;
  failed: number;
  ignored?: number;
  timestamp?: string | number;
  tests?: AuditTest[];
};

export type ProjectResourceFile = {
  name: string;
  size?: number;
};

export type ProjectJob = {
  job_id: string | number;
  pass_count?: number;
  fail_count?: number;
  ignored_count?: number;
  created_at?: string;
  status?: string;
  tests?: AuditTest[];
};

export type Project = {
  id: string | number;
  project_name: string;
  project_description?: string;
  project_prompt?: string;
  rules_mode?: "global" | "project" | "global+project";
  rules_uri?: string | null;
  urls?: string[];
  data_sources?: DataSource[] | { url: string; json_keys?: string[] }[];
  jobs?: ProjectJob[];
};
