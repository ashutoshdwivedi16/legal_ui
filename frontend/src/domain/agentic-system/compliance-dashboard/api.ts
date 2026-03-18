import { complianceEndpoints } from "./endpoints";
import type { PromptInjectionCase } from "./prompt-injection-types";
import { mockPromptInjectionCases, mockPromptInjectionResults, mockPromptInjectionRuns } from "./prompt-injection-mock";

const usePromptInjectionApi = import.meta.env.VITE_USE_PROMPT_INJECTION_API === "true";

async function parseJson(res: Response) {
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

const defaultFetchOptions: RequestInit = {
  credentials: "include",
};

const withDefaults = (options?: RequestInit): RequestInit => ({
  ...defaultFetchOptions,
  ...options,
});

// API utility functions
export async function fetchProjects() {
  const res = await fetch(complianceEndpoints.projects, withDefaults());
  const data = await parseJson(res);
  // Ensure an array is always returned
  return Array.isArray(data) ? data : (data?.projects ?? []);
}

import type { DataSource } from "./DataSourceEditor";

function buildProjectPayload(payload: {
  project_name: string;
  project_description: string;
  project_prompt?: string;
  rules_mode?: "global" | "project" | "global+project";
  rules_uri?: string | null;
  data_sources?: DataSource[];
}) {
  const dataSources = payload.data_sources ?? [];
  const completeSources = dataSources.filter((source) => {
    const hasUrl = Boolean(source.url?.trim());
    const keysFromText = source.jsonKeysText
      ? source.jsonKeysText
          .split(/\r?\n/)
          .map((key) => key.trim())
          .filter(Boolean)
      : [];
    const keys = keysFromText.length > 0 ? keysFromText : (source.jsonKeys ?? []);
    return hasUrl && keys.length > 0;
  });

  const data_sources = completeSources.map((source) => {
    const keysFromText = source.jsonKeysText
      ? source.jsonKeysText
          .split(/\r?\n/)
          .map((key) => key.trim())
          .filter(Boolean)
      : [];
    const keys = keysFromText.length > 0 ? keysFromText : (source.jsonKeys ?? []);
    return {
      url: source.url.trim(),
      json_keys: keys,
    };
  });

  return {
    project_name: payload.project_name,
    project_description: payload.project_description,
    project_prompt: payload.project_prompt,
    rules_mode: payload.rules_mode,
    rules_uri: payload.rules_uri,
    data_sources,
  };
}

export async function createProject(payload: { 
  project_name: string; 
  project_description: string;
  project_prompt?: string;
  rules_mode?: "global" | "project" | "global+project";
  rules_uri?: string | null;
  data_sources?: DataSource[];
}) {
  const res = await fetch(complianceEndpoints.projects, withDefaults({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildProjectPayload(payload)),
  }));
  return parseJson(res);
}

export async function updateProject(projectId: string | number, payload: { 
  project_name: string; 
  project_description: string;
  project_prompt?: string;
  rules_mode?: "global" | "project" | "global+project";
  rules_uri?: string | null;
  data_sources?: DataSource[];
}) {
  const res = await fetch(`${complianceEndpoints.projects}/${projectId}`, withDefaults({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildProjectPayload(payload)),
  }));
  return parseJson(res);
}

export async function deleteProject(projectId: string | number) {
  const res = await fetch(complianceEndpoints.projects + `/${projectId}`, withDefaults({
    method: "DELETE",
  }));
  if (res.status === 204) return { success: true };
  return parseJson(res);
}

export async function runAuditJob(projectId: string) {
  const res = await fetch(complianceEndpoints.runProject(projectId), withDefaults({
    method: "POST",
  }));
  return parseJson(res);
}

export async function runAuditJobWithSources(
  projectId: string | number,
  sources: Array<Record<string, unknown>>
) {
  const res = await fetch(
    complianceEndpoints.runProjectWithSources(projectId),
    withDefaults({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sources),
    })
  );
  return parseJson(res);
}

export async function ignoreAudit(
  auditId: string | number,
  payload: { ignore_reasoning: boolean; ignored_fields?: string[] }
) {
  const res = await fetch(complianceEndpoints.ignoreAudit(auditId), withDefaults({
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
  return parseJson(res);
}

export async function fetchJobDetails(jobId: string | number) {
  const res = await fetch(complianceEndpoints.jobDetails(jobId), withDefaults());
  return parseJson(res);
}

export async function fetchFailures(jobId: string | number) {
  const res = await fetch(complianceEndpoints.jobFailures(jobId), withDefaults());
  return parseJson(res);
}

export async function validatePrompt(payload: unknown) {
  const res = await fetch(complianceEndpoints.validatePrompt, withDefaults({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
  return parseJson(res);
}

export async function runPromptInjection(projectId?: string | number) {
  const res = await fetch(complianceEndpoints.promptInjectionRun, withDefaults({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(projectId ? { project_id: projectId } : {}),
  }));
  const data = await parseJson(res);
  return data;
}

// Prompt Injection API contracts
export async function fetchPromptInjectionRuns(projectId?: string | number) {
  if (!usePromptInjectionApi) return mockPromptInjectionRuns;
  const url = projectId
    ? `${complianceEndpoints.promptInjectionRuns}?project_id=${encodeURIComponent(String(projectId))}`
    : complianceEndpoints.promptInjectionRuns;
  const res = await fetch(url, withDefaults());
  const data = await parseJson(res);
  return Array.isArray(data) ? data : (data?.runs ?? []);
}

export async function fetchPromptInjectionRunDetails(runId: string | number, projectId?: string | number) {
  if (!usePromptInjectionApi) {
    return mockPromptInjectionRuns.find(r => r.run_id === runId);
  }
  const url = projectId
    ? `${complianceEndpoints.promptInjectionRunDetails(runId)}?project_id=${encodeURIComponent(String(projectId))}`
    : complianceEndpoints.promptInjectionRunDetails(runId);
  const res = await fetch(url, withDefaults());
  const data = await parseJson(res);
  // Ensure we return the run object
  return data?.run || data;
}

export async function fetchPromptInjectionCases(projectId?: string | number) {
  if (!usePromptInjectionApi) return mockPromptInjectionCases;
  const url = projectId
    ? `${complianceEndpoints.promptInjectionCases}?project_id=${encodeURIComponent(String(projectId))}`
    : complianceEndpoints.promptInjectionCases;
  const res = await fetch(url, withDefaults());
  const data = await parseJson(res);
  return Array.isArray(data) ? data : (data?.cases ?? []);
}

export async function createPromptInjectionCase(payload: Partial<PromptInjectionCase>, projectId?: string | number) {
  const res = await fetch(complianceEndpoints.promptInjectionCases, withDefaults({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, project_id: projectId }),
  }));
  return parseJson(res);
}

export async function updatePromptInjectionCase(caseId: string, payload: Partial<PromptInjectionCase>, projectId?: string | number) {
  const res = await fetch(`${complianceEndpoints.promptInjectionCases}/${caseId}`, withDefaults({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, project_id: projectId }),
  }));
  return parseJson(res);
}

export async function deletePromptInjectionCase(caseId: string, projectId?: string | number) {
  const url = projectId
    ? `${complianceEndpoints.promptInjectionCases}/${caseId}?project_id=${encodeURIComponent(String(projectId))}`
    : `${complianceEndpoints.promptInjectionCases}/${caseId}`;
  const res = await fetch(url, withDefaults({
    method: "DELETE",
  }));
  return parseJson(res);
}

export async function fetchPromptInjectionResults(runId?: string | number, projectId?: string | number) {
  if (!usePromptInjectionApi) {
    return runId
      ? mockPromptInjectionResults.filter((result) => result.run_id === runId)
      : mockPromptInjectionResults;
  }
  if (!runId) return [];
  try {
    const runDetails = await fetchPromptInjectionRunDetails(runId, projectId);
    return runDetails?.results || [];
  } catch (err) {
    console.error("Failed to fetch run details for results", err);
    return [];
  }
}

import type { RequestConfig } from "./postman-types";

export async function executeProxyRequest(config: RequestConfig): Promise<{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  time: number;
}> {
  const res = await fetch(complianceEndpoints.proxyRequest, withDefaults({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: config.method,
      url: config.url,
      headers: config.headers.filter(h => h.enabled).reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
      params: config.params.filter(p => p.enabled).reduce((acc, p) => ({ ...acc, [p.key]: p.value }), {}),
      auth: config.auth,
      body: config.body,
    }),
  }));
  return parseJson(res);
}

export async function fetchComplianceRules() {
  const res = await fetch(complianceEndpoints.rules, withDefaults());
  const data = await parseJson(res);
  return Array.isArray(data) ? data : (data?.rules ?? []);
}

export async function uploadProjectRulesFile(projectId: string | number, file: File) {
  const formData = new FormData();
  formData.append("rules_file", file);
  const res = await fetch(complianceEndpoints.rulesUpload(projectId), withDefaults({
    method: "POST",
    body: formData,
  }));
  return parseJson(res);
}
