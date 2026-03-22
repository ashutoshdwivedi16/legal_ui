-- AI Postgres schema for prompt templates

create database ai_db;

\connect ai_db;

CREATE TABLE IF NOT EXISTS comparison_prompt_templates (
  id VARCHAR(36) PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  template_type VARCHAR(20) NOT NULL, -- "system" or "user"
  content TEXT NOT NULL,
  version INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  notes TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_cpt_cat_type_active ON comparison_prompt_templates(category, template_type, is_active, version);

