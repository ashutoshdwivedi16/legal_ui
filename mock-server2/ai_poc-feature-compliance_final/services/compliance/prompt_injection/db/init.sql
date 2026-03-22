-- Prompt injection schema

CREATE TABLE IF NOT EXISTS prompt_injection_cases (
    id VARCHAR(128) PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    title VARCHAR(255) NOT NULL,
    target VARCHAR(128),
    type VARCHAR(128),
    severity VARCHAR(64) NOT NULL DEFAULT 'MEDIUM',
    attack_text TEXT,
    messages JSON,
    expected TEXT,
    tags JSON,
    application_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    source VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prompt_injection_runs (
    run_id VARCHAR(128) PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(32) NOT NULL DEFAULT 'RUNNING',
    model_name VARCHAR(255),
    model_api_base VARCHAR(255),
    rules_version VARCHAR(128),
    config JSON
);

CREATE TABLE IF NOT EXISTS prompt_injection_results (
    result_id VARCHAR(128) PRIMARY KEY,
    run_id VARCHAR(128) REFERENCES prompt_injection_runs(run_id),
    case_id VARCHAR(128) REFERENCES prompt_injection_cases(id),
    expected TEXT,
    actual TEXT,
    passed BOOLEAN NOT NULL,
    severity VARCHAR(64),
    type VARCHAR(128),
    target VARCHAR(128),
    result_json JSON,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
