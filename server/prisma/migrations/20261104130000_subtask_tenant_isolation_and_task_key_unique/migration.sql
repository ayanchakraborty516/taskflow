-- Step 1: Drop old single-column foreign key constraint
ALTER TABLE "subtasks" DROP CONSTRAINT IF EXISTS "subtasks_task_id_fkey";

-- Step 2: Add nullable workspace_id column
ALTER TABLE "subtasks" ADD COLUMN "workspace_id" TEXT;

-- Step 3: Backfill workspace_id from parent Task
UPDATE "subtasks" s
SET "workspace_id" = t."workspace_id"
FROM "tasks" t
WHERE s."task_id" = t."id";

-- Step 4: Verify no Subtask has a null workspace_id before enforcing NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "subtasks" WHERE "workspace_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL on workspace_id: orphaned subtasks detected.';
  END IF;
END $$;

-- Step 5: Enforce NOT NULL constraint on workspace_id
ALTER TABLE "subtasks" ALTER COLUMN "workspace_id" SET NOT NULL;

-- Step 6: Create index on subtasks(workspace_id, task_id)
CREATE INDEX "subtasks_workspace_id_task_id_idx" ON "subtasks"("workspace_id", "task_id");

-- Step 7: Add composite foreign key constraint from subtasks(workspace_id, task_id) to tasks(workspace_id, id)
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_workspace_id_task_id_fkey"
  FOREIGN KEY ("workspace_id", "task_id")
  REFERENCES "tasks"("workspace_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Verify no duplicate non-null task keys exist per project before adding unique constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "tasks"
    WHERE "key" IS NOT NULL AND TRIM("key") != ''
    GROUP BY "project_id", "key"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique constraint on tasks(project_id, key): duplicate keys detected.';
  END IF;
END $$;

-- Step 9: Add unique constraint on tasks(project_id, key)
CREATE UNIQUE INDEX "tasks_project_id_key_key" ON "tasks"("project_id", "key");

