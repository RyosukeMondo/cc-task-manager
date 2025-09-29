-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'USER', 'MODERATOR');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "claude_task_status" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "execution_status" AS ENUM ('INITIALIZING', 'STARTING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "queue_job_status" AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED', 'FAILED', 'DELAYED', 'PAUSED', 'STUCK');

-- CreateEnum
CREATE TYPE "attempt_status" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "backoff_type" AS ENUM ('FIXED', 'EXPONENTIAL', 'LINEAR');

-- CreateEnum
CREATE TYPE "log_level" AS ENUM ('TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL');

-- CreateEnum
CREATE TYPE "log_source" AS ENUM ('SYSTEM', 'CLAUDE', 'USER', 'QUEUE', 'WORKER', 'DATABASE');

-- CreateEnum
CREATE TYPE "metric_type" AS ENUM ('COUNTER', 'GAUGE', 'HISTOGRAM', 'SUMMARY', 'TIMER');

-- CreateEnum
CREATE TYPE "result_status" AS ENUM ('SUCCESS', 'PARTIAL_SUCCESS', 'FAILURE', 'ERROR', 'TIMEOUT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "task_status" NOT NULL DEFAULT 'TODO',
    "priority" "task_priority" NOT NULL DEFAULT 'MEDIUM',
    "created_by_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "project_id" TEXT,
    "tags" TEXT[],
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_info" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claude_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "config" JSONB,
    "status" "claude_task_status" NOT NULL DEFAULT 'PENDING',
    "priority" "task_priority" NOT NULL DEFAULT 'MEDIUM',
    "created_by_id" TEXT NOT NULL,
    "project_id" TEXT,
    "tags" TEXT[],
    "estimated_duration" INTEGER,
    "actual_duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "claude_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_executions" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "status" "execution_status" NOT NULL DEFAULT 'INITIALIZING',
    "progress" DOUBLE PRECISION DEFAULT 0.0,
    "worker_id" TEXT,
    "process_id" TEXT,
    "session_id" TEXT,
    "cpu_usage" DOUBLE PRECISION,
    "memory_usage" INTEGER,
    "disk_usage" INTEGER,
    "error_message" TEXT,
    "error_code" TEXT,
    "stack_trace" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_heartbeat" TIMESTAMP(3),

    CONSTRAINT "task_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_jobs" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "queue_name" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "status" "queue_job_status" NOT NULL DEFAULT 'WAITING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "delay" INTEGER DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "backoff_type" "backoff_type" NOT NULL DEFAULT 'EXPONENTIAL',
    "backoff_delay" INTEGER NOT NULL DEFAULT 2000,
    "job_data" JSONB NOT NULL,
    "job_options" JSONB,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "queue_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_attempts" (
    "id" TEXT NOT NULL,
    "queue_job_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "attempt_status" NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "result" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "job_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_logs" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "level" "log_level" NOT NULL DEFAULT 'INFO',
    "source" "log_source" NOT NULL DEFAULT 'SYSTEM',
    "message" TEXT NOT NULL,
    "details" JSONB,
    "component" TEXT,
    "operation" TEXT,
    "correlation_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT,
    "metric_type" "metric_type" NOT NULL,
    "metric_name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "worker_id" TEXT,
    "queue_name" TEXT,
    "tags" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_results" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "status" "result_status" NOT NULL DEFAULT 'SUCCESS',
    "summary" TEXT,
    "output" JSONB,
    "execution_time" INTEGER,
    "tokens_used" INTEGER,
    "cost_estimate" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_files" (
    "id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_created_by_id_idx" ON "tasks"("created_by_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_is_active_idx" ON "user_sessions"("is_active");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "claude_tasks_status_idx" ON "claude_tasks"("status");

-- CreateIndex
CREATE INDEX "claude_tasks_priority_idx" ON "claude_tasks"("priority");

-- CreateIndex
CREATE INDEX "claude_tasks_created_by_id_idx" ON "claude_tasks"("created_by_id");

-- CreateIndex
CREATE INDEX "claude_tasks_scheduled_at_idx" ON "claude_tasks"("scheduled_at");

-- CreateIndex
CREATE INDEX "claude_tasks_started_at_idx" ON "claude_tasks"("started_at");

-- CreateIndex
CREATE INDEX "task_executions_task_id_idx" ON "task_executions"("task_id");

-- CreateIndex
CREATE INDEX "task_executions_status_idx" ON "task_executions"("status");

-- CreateIndex
CREATE INDEX "task_executions_worker_id_idx" ON "task_executions"("worker_id");

-- CreateIndex
CREATE INDEX "task_executions_started_at_idx" ON "task_executions"("started_at");

-- CreateIndex
CREATE INDEX "task_executions_last_heartbeat_idx" ON "task_executions"("last_heartbeat");

-- CreateIndex
CREATE UNIQUE INDEX "queue_jobs_job_id_key" ON "queue_jobs"("job_id");

-- CreateIndex
CREATE INDEX "queue_jobs_queue_name_idx" ON "queue_jobs"("queue_name");

-- CreateIndex
CREATE INDEX "queue_jobs_status_idx" ON "queue_jobs"("status");

-- CreateIndex
CREATE INDEX "queue_jobs_priority_idx" ON "queue_jobs"("priority");

-- CreateIndex
CREATE INDEX "queue_jobs_created_at_idx" ON "queue_jobs"("created_at");

-- CreateIndex
CREATE INDEX "queue_jobs_job_id_idx" ON "queue_jobs"("job_id");

-- CreateIndex
CREATE INDEX "job_attempts_queue_job_id_idx" ON "job_attempts"("queue_job_id");

-- CreateIndex
CREATE INDEX "job_attempts_attempt_number_idx" ON "job_attempts"("attempt_number");

-- CreateIndex
CREATE INDEX "job_attempts_status_idx" ON "job_attempts"("status");

-- CreateIndex
CREATE INDEX "job_attempts_started_at_idx" ON "job_attempts"("started_at");

-- CreateIndex
CREATE INDEX "execution_logs_execution_id_idx" ON "execution_logs"("execution_id");

-- CreateIndex
CREATE INDEX "execution_logs_level_idx" ON "execution_logs"("level");

-- CreateIndex
CREATE INDEX "execution_logs_source_idx" ON "execution_logs"("source");

-- CreateIndex
CREATE INDEX "execution_logs_timestamp_idx" ON "execution_logs"("timestamp");

-- CreateIndex
CREATE INDEX "execution_logs_correlation_id_idx" ON "execution_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "system_metrics_metric_type_idx" ON "system_metrics"("metric_type");

-- CreateIndex
CREATE INDEX "system_metrics_metric_name_idx" ON "system_metrics"("metric_name");

-- CreateIndex
CREATE INDEX "system_metrics_timestamp_idx" ON "system_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "system_metrics_worker_id_idx" ON "system_metrics"("worker_id");

-- CreateIndex
CREATE INDEX "system_metrics_execution_id_idx" ON "system_metrics"("execution_id");

-- CreateIndex
CREATE INDEX "task_results_task_id_idx" ON "task_results"("task_id");

-- CreateIndex
CREATE INDEX "task_results_status_idx" ON "task_results"("status");

-- CreateIndex
CREATE INDEX "task_results_created_at_idx" ON "task_results"("created_at");

-- CreateIndex
CREATE INDEX "result_files_result_id_idx" ON "result_files"("result_id");

-- CreateIndex
CREATE INDEX "result_files_filename_idx" ON "result_files"("filename");

-- CreateIndex
CREATE INDEX "result_files_content_type_idx" ON "result_files"("content_type");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claude_tasks" ADD CONSTRAINT "claude_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claude_tasks" ADD CONSTRAINT "claude_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "claude_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_jobs" ADD CONSTRAINT "queue_jobs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "claude_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_attempts" ADD CONSTRAINT "job_attempts_queue_job_id_fkey" FOREIGN KEY ("queue_job_id") REFERENCES "queue_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "task_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_metrics" ADD CONSTRAINT "system_metrics_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "task_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_results" ADD CONSTRAINT "task_results_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "claude_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_files" ADD CONSTRAINT "result_files_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "task_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;