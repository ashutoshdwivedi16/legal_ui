-- Add project-specific rules settings
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS rules_mode VARCHAR(32) NOT NULL DEFAULT 'global',
    ADD COLUMN IF NOT EXISTS rules_uri VARCHAR(2048);
