-- V0_1_0_9__drop_permission_description_column.sql
-- Drop description column (permissions are auto-synced, no manual descriptions)

ALTER TABLE permissions DROP COLUMN IF EXISTS description;

-- Drop the index on permission_string (will be recreated with UNIQUE constraint)
DROP INDEX IF EXISTS idx_permissions_permission_string;
