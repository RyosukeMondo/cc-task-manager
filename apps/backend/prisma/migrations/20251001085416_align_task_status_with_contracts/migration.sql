-- Align ApiTaskStatus enum with Task contract (Option B: Kanban workflow)
-- This migration drops existing data as per user confirmation

-- Drop existing api_tasks table and enum
DROP TABLE IF EXISTS "api_tasks" CASCADE;
DROP TYPE IF EXISTS "api_task_status" CASCADE;
DROP TYPE IF EXISTS "api_task_priority" CASCADE;

-- CreateEnum with new values (aligned with Task contract)
CREATE TYPE "api_task_status" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "api_task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "api_tasks" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "api_task_status" NOT NULL DEFAULT 'TODO',
    "priority" "api_task_priority" NOT NULL DEFAULT 'MEDIUM',
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "logs" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "api_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_tasks_user_id_status_idx" ON "api_tasks"("user_id", "status");

-- CreateIndex
CREATE INDEX "api_tasks_created_at_idx" ON "api_tasks"("created_at");

-- AddForeignKey
ALTER TABLE "api_tasks" ADD CONSTRAINT "api_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
