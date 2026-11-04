-- Step 1: Drop old foreign key constraint
ALTER TABLE "project_members" DROP CONSTRAINT IF EXISTS "project_members_project_id_fkey";

-- Step 2: Add nullable workspace_id column
ALTER TABLE "project_members" ADD COLUMN "workspace_id" TEXT;

-- Step 3: Backfill workspace_id from corresponding Project
UPDATE "project_members" pm
SET "workspace_id" = p."workspace_id"
FROM "projects" p
WHERE pm."project_id" = p."id";

-- Step 4: Validate that no rows remain with null workspace_id before enforcing NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "project_members" WHERE "workspace_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL on workspace_id: orphaned project_members rows detected.';
  END IF;
END $$;

-- Step 5: Enforce NOT NULL constraint
ALTER TABLE "project_members" ALTER COLUMN "workspace_id" SET NOT NULL;

-- Step 6: Create index on (workspace_id, user_id)
CREATE INDEX "project_members_workspace_id_user_id_idx" ON "project_members"("workspace_id", "user_id");

-- Step 7: Add composite foreign key to projects(workspace_id, id)
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_workspace_id_project_id_fkey" 
  FOREIGN KEY ("workspace_id", "project_id") 
  REFERENCES "projects"("workspace_id", "id") 
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Add composite foreign key to workspace_members(workspace_id, user_id)
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_workspace_id_user_id_fkey" 
  FOREIGN KEY ("workspace_id", "user_id") 
  REFERENCES "workspace_members"("workspace_id", "user_id") 
  ON DELETE CASCADE ON UPDATE CASCADE;
