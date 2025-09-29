-- Add performance indexes for Claude Code database schema
-- Optimized for sub-50ms query performance on monitoring and reporting operations

-- Task model performance indexes
CREATE INDEX "tasks_completed_at_idx" ON "tasks"("completed_at");
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");
CREATE INDEX "tasks_status_priority_idx" ON "tasks"("status", "priority");
CREATE INDEX "tasks_status_assignee_id_idx" ON "tasks"("status", "assignee_id");
CREATE INDEX "tasks_created_by_id_status_idx" ON "tasks"("created_by_id", "status");
CREATE INDEX "tasks_project_id_status_idx" ON "tasks"("project_id", "status");
CREATE INDEX "tasks_assignee_id_status_idx" ON "tasks"("assignee_id", "status");
CREATE INDEX "tasks_status_due_date_idx" ON "tasks"("status", "due_date");
CREATE INDEX "tasks_status_priority_assignee_id_idx" ON "tasks"("status", "priority", "assignee_id");
CREATE INDEX "tasks_project_id_status_priority_idx" ON "tasks"("project_id", "status", "priority");
CREATE INDEX "tasks_assignee_id_status_due_date_idx" ON "tasks"("assignee_id", "status", "due_date");

-- ClaudeTask model performance indexes
CREATE INDEX "claude_tasks_completed_at_idx" ON "claude_tasks"("completed_at");
CREATE INDEX "claude_tasks_project_id_idx" ON "claude_tasks"("project_id");
CREATE INDEX "claude_tasks_status_priority_idx" ON "claude_tasks"("status", "priority");
CREATE INDEX "claude_tasks_status_created_by_id_idx" ON "claude_tasks"("status", "created_by_id");
CREATE INDEX "claude_tasks_created_by_id_status_idx" ON "claude_tasks"("created_by_id", "status");
CREATE INDEX "claude_tasks_project_id_status_idx" ON "claude_tasks"("project_id", "status");
CREATE INDEX "claude_tasks_status_scheduled_at_idx" ON "claude_tasks"("status", "scheduled_at");
CREATE INDEX "claude_tasks_status_started_at_idx" ON "claude_tasks"("status", "started_at");
CREATE INDEX "claude_tasks_created_by_id_created_at_idx" ON "claude_tasks"("created_by_id", "created_at");
CREATE INDEX "claude_tasks_status_completed_at_started_at_idx" ON "claude_tasks"("status", "completed_at", "started_at");
CREATE INDEX "claude_tasks_created_by_id_status_priority_idx" ON "claude_tasks"("created_by_id", "status", "priority");

-- TaskExecution model performance indexes
CREATE INDEX "task_executions_completed_at_idx" ON "task_executions"("completed_at");
CREATE INDEX "task_executions_process_id_idx" ON "task_executions"("process_id");
CREATE INDEX "task_executions_session_id_idx" ON "task_executions"("session_id");
CREATE INDEX "task_executions_task_id_status_idx" ON "task_executions"("task_id", "status");
CREATE INDEX "task_executions_status_worker_id_idx" ON "task_executions"("status", "worker_id");
CREATE INDEX "task_executions_status_started_at_idx" ON "task_executions"("status", "started_at");
CREATE INDEX "task_executions_worker_id_status_idx" ON "task_executions"("worker_id", "status");
CREATE INDEX "task_executions_task_id_status_started_at_idx" ON "task_executions"("task_id", "status", "started_at");
CREATE INDEX "task_executions_status_last_heartbeat_idx" ON "task_executions"("status", "last_heartbeat");
CREATE INDEX "task_executions_worker_id_last_heartbeat_idx" ON "task_executions"("worker_id", "last_heartbeat");
CREATE INDEX "task_executions_status_completed_at_started_at_idx" ON "task_executions"("status", "completed_at", "started_at");
CREATE INDEX "task_executions_status_worker_id_started_at_idx" ON "task_executions"("status", "worker_id", "started_at");

-- QueueJob model performance indexes
CREATE INDEX "queue_jobs_task_id_idx" ON "queue_jobs"("task_id");
CREATE INDEX "queue_jobs_processed_at_idx" ON "queue_jobs"("processed_at");
CREATE INDEX "queue_jobs_finished_at_idx" ON "queue_jobs"("finished_at");
CREATE INDEX "queue_jobs_queue_name_status_idx" ON "queue_jobs"("queue_name", "status");
CREATE INDEX "queue_jobs_status_priority_idx" ON "queue_jobs"("status", "priority");
CREATE INDEX "queue_jobs_queue_name_priority_idx" ON "queue_jobs"("queue_name", "priority");
CREATE INDEX "queue_jobs_status_created_at_idx" ON "queue_jobs"("status", "created_at");
CREATE INDEX "queue_jobs_task_id_status_idx" ON "queue_jobs"("task_id", "status");
CREATE INDEX "queue_jobs_queue_name_status_priority_idx" ON "queue_jobs"("queue_name", "status", "priority");
CREATE INDEX "queue_jobs_status_delay_priority_idx" ON "queue_jobs"("status", "delay", "priority");
CREATE INDEX "queue_jobs_queue_name_created_at_idx" ON "queue_jobs"("queue_name", "created_at");
CREATE INDEX "queue_jobs_status_processed_at_idx" ON "queue_jobs"("status", "processed_at");
CREATE INDEX "queue_jobs_queue_name_status_created_at_idx" ON "queue_jobs"("queue_name", "status", "created_at");

-- JobAttempt model performance indexes
CREATE INDEX "job_attempts_finished_at_idx" ON "job_attempts"("finished_at");
CREATE INDEX "job_attempts_queue_job_id_attempt_number_idx" ON "job_attempts"("queue_job_id", "attempt_number");
CREATE INDEX "job_attempts_queue_job_id_status_idx" ON "job_attempts"("queue_job_id", "status");
CREATE INDEX "job_attempts_status_started_at_idx" ON "job_attempts"("status", "started_at");
CREATE INDEX "job_attempts_queue_job_id_status_attempt_number_idx" ON "job_attempts"("queue_job_id", "status", "attempt_number");

-- ExecutionLog model performance indexes
CREATE INDEX "execution_logs_component_idx" ON "execution_logs"("component");
CREATE INDEX "execution_logs_operation_idx" ON "execution_logs"("operation");
CREATE INDEX "execution_logs_execution_id_level_idx" ON "execution_logs"("execution_id", "level");
CREATE INDEX "execution_logs_execution_id_timestamp_idx" ON "execution_logs"("execution_id", "timestamp");
CREATE INDEX "execution_logs_level_timestamp_idx" ON "execution_logs"("level", "timestamp");
CREATE INDEX "execution_logs_source_level_idx" ON "execution_logs"("source", "level");
CREATE INDEX "execution_logs_correlation_id_timestamp_idx" ON "execution_logs"("correlation_id", "timestamp");
CREATE INDEX "execution_logs_execution_id_level_timestamp_idx" ON "execution_logs"("execution_id", "level", "timestamp");
CREATE INDEX "execution_logs_source_level_timestamp_idx" ON "execution_logs"("source", "level", "timestamp");
CREATE INDEX "execution_logs_component_level_timestamp_idx" ON "execution_logs"("component", "level", "timestamp");
CREATE INDEX "execution_logs_level_source_timestamp_idx" ON "execution_logs"("level", "source", "timestamp");

-- SystemMetric model performance indexes
CREATE INDEX "system_metrics_queue_name_idx" ON "system_metrics"("queue_name");
CREATE INDEX "system_metrics_metric_type_metric_name_idx" ON "system_metrics"("metric_type", "metric_name");
CREATE INDEX "system_metrics_metric_type_timestamp_idx" ON "system_metrics"("metric_type", "timestamp");
CREATE INDEX "system_metrics_metric_name_timestamp_idx" ON "system_metrics"("metric_name", "timestamp");
CREATE INDEX "system_metrics_worker_id_timestamp_idx" ON "system_metrics"("worker_id", "timestamp");
CREATE INDEX "system_metrics_execution_id_timestamp_idx" ON "system_metrics"("execution_id", "timestamp");
CREATE INDEX "system_metrics_metric_type_metric_name_timestamp_idx" ON "system_metrics"("metric_type", "metric_name", "timestamp");
CREATE INDEX "system_metrics_worker_id_metric_type_timestamp_idx" ON "system_metrics"("worker_id", "metric_type", "timestamp");
CREATE INDEX "system_metrics_execution_id_metric_type_timestamp_idx" ON "system_metrics"("execution_id", "metric_type", "timestamp");
CREATE INDEX "system_metrics_metric_type_worker_id_timestamp_idx" ON "system_metrics"("metric_type", "worker_id", "timestamp");
CREATE INDEX "system_metrics_queue_name_metric_type_timestamp_idx" ON "system_metrics"("queue_name", "metric_type", "timestamp");

-- TaskResult model performance indexes
CREATE INDEX "task_results_task_id_status_idx" ON "task_results"("task_id", "status");
CREATE INDEX "task_results_status_created_at_idx" ON "task_results"("status", "created_at");
CREATE INDEX "task_results_task_id_created_at_idx" ON "task_results"("task_id", "created_at");
CREATE INDEX "task_results_task_id_status_created_at_idx" ON "task_results"("task_id", "status", "created_at");

-- ResultFile model performance indexes
CREATE INDEX "result_files_size_idx" ON "result_files"("size");
CREATE INDEX "result_files_result_id_filename_idx" ON "result_files"("result_id", "filename");
CREATE INDEX "result_files_content_type_size_idx" ON "result_files"("content_type", "size");
CREATE INDEX "result_files_result_id_content_type_idx" ON "result_files"("result_id", "content_type");
CREATE INDEX "result_files_filename_content_type_idx" ON "result_files"("filename", "content_type");
CREATE INDEX "result_files_result_id_created_at_idx" ON "result_files"("result_id", "created_at");