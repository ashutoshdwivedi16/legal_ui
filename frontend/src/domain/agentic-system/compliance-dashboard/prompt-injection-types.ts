export type PromptInjectionCase = {
  id: string;
  title: string;
  target: string;
  type: string;
  severity: string;
  attack_text: string;
  messages?: Record<string, unknown> | null;
  expected: string;
  tags?: string[] | null;
  application_name?: string | null;
  is_active?: boolean;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PromptInjectionRun = {
  run_id: string;
  started_at?: string;
  completed_at?: string;
  model_name?: string;
  model_api_base?: string;
  rules_version?: string;
  config?: Record<string, unknown> | null;
  summary?: {
    total?: number;
    passed?: number;
    failed?: number;
    total_cases?: number;
  } | null;
  total_cases?: number;
};

export type PromptInjectionResult = {
  result_id: string;
  run_id: string;
  case_id: string;
  expected: string;
  actual: string;
  passed: boolean;
  severity: string;
  type: string;
  target: string;
  result_json?: Record<string, unknown> | null;
  created_at?: string;
};
