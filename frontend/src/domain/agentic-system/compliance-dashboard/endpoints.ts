export const COMPLIANCE_API_BASE_URL = "/us/common/ai/v1/compliance";

export const complianceEndpoints = {
  projects: `${COMPLIANCE_API_BASE_URL}/projects`,
  runProject: (projectId: string | number) =>
    `${COMPLIANCE_API_BASE_URL}/projects/${projectId}/run`,
  runProjectWithSources: (projectId: string | number) =>
    `${COMPLIANCE_API_BASE_URL}/projects/${projectId}/run-with-sources`,
  jobDetails: (jobId: string | number) =>
    `${COMPLIANCE_API_BASE_URL}/jobs/${jobId}/details`,
  jobFailures: (jobId: string | number) =>
    `${COMPLIANCE_API_BASE_URL}/jobs/${jobId}/failures`,
  ignoreAudit: (auditId: string | number) =>
    `${COMPLIANCE_API_BASE_URL}/audits/${auditId}/ignore`,
  validatePrompt: `${COMPLIANCE_API_BASE_URL}/validate-prompt`,
  promptInjectionCases: `${COMPLIANCE_API_BASE_URL}/prompt-injection/cases`,
  promptInjectionRun: `${COMPLIANCE_API_BASE_URL}/prompt-injection/run`,
  promptInjectionRuns: `${COMPLIANCE_API_BASE_URL}/prompt-injection/runs`,
  promptInjectionRunDetails: (runId: string | number) =>
    `${COMPLIANCE_API_BASE_URL}/prompt-injection/runs/${runId}`,
  promptInjectionLatestRun: `${COMPLIANCE_API_BASE_URL}/prompt-injection/runs/latest`,
  rules: `${COMPLIANCE_API_BASE_URL}/rules`,
  testJson: `${COMPLIANCE_API_BASE_URL}/test-json`,
  rulesUpload: (projectId: string | number) =>
    `${COMPLIANCE_API_BASE_URL}/projects/${projectId}/rules/upload`,
  proxyRequest: `${COMPLIANCE_API_BASE_URL}/proxy-request`,
};
