-- Add is_admin flag to roles table
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Set existing ADMIN role to is_admin = true
UPDATE roles SET is_admin = TRUE WHERE name = 'ADMIN';
