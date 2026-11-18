-- Migrate EDITOR users to SUPERVISOR
UPDATE "User" SET role = 'SUPERVISOR' WHERE role = 'EDITOR';

-- Remove default from role column
ALTER TABLE "User" ALTER COLUMN role DROP DEFAULT;

-- Now remove EDITOR from the enum by recreating the type
CREATE TYPE "Role_new" AS ENUM ('CREATOR', 'SUPERVISOR', 'MANAGER', 'ADMIN');

-- Update the User table to use new enum
ALTER TABLE "User" ALTER COLUMN role TYPE "Role_new" USING role::text::"Role_new";

-- Drop old enum and rename
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- Add default back
ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'CREATOR';