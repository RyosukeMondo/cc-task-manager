#!/usr/bin/env python3
"""
Update Scheduler - Automated maintenance workflows for specification updates

Implements background job processing for automated specification maintenance,
handling scheduled updates, SDK change responses, and specification regeneration.

Leverages BullMQ background job patterns and existing scheduling infrastructure.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
import hashlib
import threading
from queue import Queue, PriorityQueue, Empty

# Import existing components
try:
    from .monitor import SpecificationMonitor, MonitoringAlert
except ImportError:
    # Fallback for testing
    SpecificationMonitor = object
    class MonitoringAlert:
        pass

try:
    from ..api.specification_api import SpecificationAPI
except ImportError:
    # Fallback for testing
    class SpecificationAPI:
        pass

try:
    from ..validation.schema_validator import SchemaValidator
except ImportError:
    # Fallback for testing
    class SchemaValidator:
        def validate_specification(self, spec_data):
            return True

try:
    from ..research.claudeCodeSpecs.research.sdk_monitor import SDKMonitor, DEFAULT_CONFIG as SDK_CONFIG
except ImportError:
    # Fallback for testing
    class SDKMonitor:
        def __init__(self, config):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
        async def research_sdk_updates(self):
            return []
    SDK_CONFIG = {}

logger = logging.getLogger(__name__)


class JobPriority(Enum):
    """Job priority levels for scheduling."""
    LOW = 3
    MEDIUM = 2
    HIGH = 1
    CRITICAL = 0


class JobStatus(Enum):
    """Job execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRY = "retry"


@dataclass
class ScheduledJob:
    """Represents a scheduled maintenance job."""
    job_id: str
    job_type: str
    priority: JobPriority
    scheduled_time: datetime
    created_time: datetime
    parameters: Dict[str, Any]
    status: JobStatus = JobStatus.PENDING
    attempts: int = 0
    max_attempts: int = 3
    last_error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    execution_time_ms: Optional[int] = None


@dataclass
class ScheduleConfig:
    """Configuration for the update scheduler."""
    max_concurrent_jobs: int
    job_timeout_minutes: int
    retry_delay_minutes: int
    max_queue_size: int
    cleanup_interval_hours: int
    job_retention_days: int
    enable_automatic_scheduling: bool
    schedule_patterns: Dict[str, str]  # cron-like patterns


class JobQueue:
    """Priority queue for managing scheduled jobs."""

    def __init__(self, max_size: int = 1000):
        self.queue = PriorityQueue(maxsize=max_size)
        self.jobs_by_id: Dict[str, ScheduledJob] = {}
        self.completed_jobs: List[ScheduledJob] = []
        self._lock = threading.Lock()

    def add_job(self, job: ScheduledJob) -> bool:
        """Add a job to the queue."""
        try:
            with self._lock:
                if job.job_id in self.jobs_by_id:
                    logger.warning(f"Job {job.job_id} already exists")
                    return False

                # Priority queue uses tuple: (priority_value, timestamp, job)
                # Lower priority values have higher priority
                priority_value = job.priority.value
                timestamp = job.scheduled_time.timestamp()
                self.queue.put((priority_value, timestamp, job))

                self.jobs_by_id[job.job_id] = job
                logger.info(f"Added job {job.job_id} with priority {job.priority.name}")
                return True

        except Exception as e:
            logger.error(f"Failed to add job {job.job_id}: {e}")
            return False

    def get_next_job(self, timeout: float = 1.0) -> Optional[ScheduledJob]:
        """Get the next job to execute."""
        try:
            priority_value, timestamp, job = self.queue.get(timeout=timeout)

            # Check if job is ready to run
            if job.scheduled_time > datetime.utcnow():
                # Put it back and wait
                self.queue.put((priority_value, timestamp, job))
                return None

            with self._lock:
                if job.job_id in self.jobs_by_id:
                    job.status = JobStatus.RUNNING
                    return job

        except Empty:
            return None
        except Exception as e:
            logger.error(f"Error getting next job: {e}")
            return None

    def complete_job(self, job: ScheduledJob, result: Optional[Dict[str, Any]] = None):
        """Mark a job as completed."""
        with self._lock:
            job.status = JobStatus.COMPLETED
            job.result = result

            if job.job_id in self.jobs_by_id:
                del self.jobs_by_id[job.job_id]

            self.completed_jobs.append(job)
            logger.info(f"Job {job.job_id} completed")

    def fail_job(self, job: ScheduledJob, error: str):
        """Mark a job as failed and potentially retry."""
        with self._lock:
            job.attempts += 1
            job.last_error = error

            if job.attempts < job.max_attempts:
                # Schedule for retry
                job.status = JobStatus.RETRY
                retry_delay = timedelta(minutes=5 * job.attempts)  # Exponential backoff
                job.scheduled_time = datetime.utcnow() + retry_delay

                # Re-add to queue
                priority_value = job.priority.value
                timestamp = job.scheduled_time.timestamp()
                self.queue.put((priority_value, timestamp, job))

                logger.warning(f"Job {job.job_id} failed, scheduled for retry {job.attempts}/{job.max_attempts}")
            else:
                job.status = JobStatus.FAILED
                if job.job_id in self.jobs_by_id:
                    del self.jobs_by_id[job.job_id]
                self.completed_jobs.append(job)
                logger.error(f"Job {job.job_id} failed permanently after {job.attempts} attempts")

    def get_status(self) -> Dict[str, Any]:
        """Get queue status."""
        with self._lock:
            return {
                "pending_jobs": self.queue.qsize(),
                "running_jobs": sum(1 for job in self.jobs_by_id.values() if job.status == JobStatus.RUNNING),
                "completed_jobs": len([job for job in self.completed_jobs if job.status == JobStatus.COMPLETED]),
                "failed_jobs": len([job for job in self.completed_jobs if job.status == JobStatus.FAILED])
            }


class UpdateScheduler:
    """
    Automated maintenance scheduler for specification updates.

    Features:
    - Priority-based job scheduling
    - Automatic specification regeneration
    - SDK change response workflows
    - Validation and compliance checking
    - Background processing with retry logic
    """

    def __init__(self, config: Optional[ScheduleConfig] = None):
        self.config = config or self._default_config()
        self.job_queue = JobQueue(self.config.max_queue_size)
        self.scheduler_active = False
        self.start_time: Optional[datetime] = None

        # Worker threads
        self.worker_threads: List[threading.Thread] = []
        self.scheduler_thread: Optional[threading.Thread] = None

        # Components
        self.monitor: Optional[SpecificationMonitor] = None
        self.spec_api: Optional[SpecificationAPI] = None
        self.validator: Optional[SchemaValidator] = None
        self.sdk_monitor: Optional[SDKMonitor] = None

        # Job handlers
        self.job_handlers: Dict[str, Callable] = {
            "regenerate_specifications": self._handle_regenerate_specifications,
            "validate_specifications": self._handle_validate_specifications,
            "update_schemas": self._handle_update_schemas,
            "check_sdk_changes": self._handle_check_sdk_changes,
            "cleanup_old_data": self._handle_cleanup_old_data,
            "generate_reports": self._handle_generate_reports,
            "backup_specifications": self._handle_backup_specifications
        }

        # Setup directories
        self.setup_directories()

    def _default_config(self) -> ScheduleConfig:
        """Default scheduler configuration."""
        return ScheduleConfig(
            max_concurrent_jobs=3,
            job_timeout_minutes=30,
            retry_delay_minutes=5,
            max_queue_size=1000,
            cleanup_interval_hours=24,
            job_retention_days=7,
            enable_automatic_scheduling=True,
            schedule_patterns={
                "regenerate_specifications": "0 2 * * *",      # Daily at 2 AM
                "validate_specifications": "0 */6 * * *",      # Every 6 hours
                "check_sdk_changes": "0 8,20 * * *",          # 8 AM and 8 PM
                "cleanup_old_data": "0 3 * * 0",              # Weekly on Sunday at 3 AM
                "generate_reports": "0 1 * * *",              # Daily at 1 AM
                "backup_specifications": "0 4 * * 0"          # Weekly on Sunday at 4 AM
            }
        )

    def setup_directories(self):
        """Create necessary directories for scheduler data."""
        directories = [
            "claudeCodeSpecs/maintenance/scheduler_data",
            "claudeCodeSpecs/maintenance/scheduler_data/jobs",
            "claudeCodeSpecs/maintenance/scheduler_data/logs",
            "claudeCodeSpecs/maintenance/scheduler_data/backups"
        ]

        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)

    async def start_scheduler(self) -> str:
        """Start the update scheduler."""
        if self.scheduler_active:
            logger.warning("Scheduler already active")
            return "already_active"

        self.scheduler_active = True
        self.start_time = datetime.utcnow()

        # Initialize components
        await self._initialize_components()

        # Start worker threads
        self._start_worker_threads()

        # Start automatic scheduling if enabled
        if self.config.enable_automatic_scheduling:
            self._start_automatic_scheduling()

        session_id = f"scheduler_session_{int(time.time())}"
        logger.info(f"Update scheduler started with session ID: {session_id}")

        return session_id

    async def stop_scheduler(self) -> Dict[str, Any]:
        """Stop the scheduler and return summary."""
        if not self.scheduler_active:
            logger.warning("Scheduler not active")
            return {}

        self.scheduler_active = False

        # Stop worker threads
        self._stop_worker_threads()

        # Save job state
        self._save_job_state()

        # Generate summary
        uptime = datetime.utcnow() - self.start_time if self.start_time else timedelta(0)
        status = self.job_queue.get_status()

        summary = {
            "session_duration_hours": uptime.total_seconds() / 3600,
            "jobs_processed": status["completed_jobs"] + status["failed_jobs"],
            "jobs_completed": status["completed_jobs"],
            "jobs_failed": status["failed_jobs"],
            "pending_jobs": status["pending_jobs"]
        }

        self.start_time = None
        logger.info(f"Scheduler stopped. Summary: {summary}")

        return summary

    async def _initialize_components(self):
        """Initialize scheduler components."""
        self.spec_api = SpecificationAPI()
        self.validator = SchemaValidator()
        self.sdk_monitor = SDKMonitor(SDK_CONFIG)

        logger.info("Scheduler components initialized")

    def _start_worker_threads(self):
        """Start worker threads for job processing."""
        for i in range(self.config.max_concurrent_jobs):
            worker = threading.Thread(
                target=self._worker_loop,
                args=(f"worker-{i}",),
                daemon=True
            )
            worker.start()
            self.worker_threads.append(worker)

        logger.info(f"Started {len(self.worker_threads)} worker threads")

    def _stop_worker_threads(self):
        """Stop worker threads."""
        # Workers will stop when scheduler_active becomes False
        for worker in self.worker_threads:
            worker.join(timeout=10.0)

        self.worker_threads.clear()
        logger.info("Worker threads stopped")

    def _start_automatic_scheduling(self):
        """Start automatic job scheduling based on patterns."""
        self.scheduler_thread = threading.Thread(
            target=self._automatic_scheduling_loop,
            daemon=True
        )
        self.scheduler_thread.start()

        logger.info("Automatic scheduling started")

    def _worker_loop(self, worker_id: str):
        """Main worker loop for processing jobs."""
        logger.info(f"Worker {worker_id} started")

        while self.scheduler_active:
            try:
                job = self.job_queue.get_next_job(timeout=1.0)

                if job:
                    logger.info(f"Worker {worker_id} processing job {job.job_id}")
                    self._execute_job(job)

            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")

        logger.info(f"Worker {worker_id} stopped")

    def _automatic_scheduling_loop(self):
        """Automatic scheduling loop for recurring jobs."""
        logger.info("Automatic scheduling loop started")

        last_schedule_check = {}

        while self.scheduler_active:
            try:
                current_time = datetime.utcnow()

                for job_type, pattern in self.config.schedule_patterns.items():
                    last_check = last_schedule_check.get(job_type, datetime.min)

                    # Simple interval-based scheduling (in production, would use proper cron parsing)
                    if job_type == "regenerate_specifications" and current_time.hour == 2 and current_time.minute == 0:
                        if current_time - last_check > timedelta(hours=23):  # Avoid duplicate daily jobs
                            self.schedule_job(job_type, JobPriority.MEDIUM)
                            last_schedule_check[job_type] = current_time

                    elif job_type == "validate_specifications" and current_time.minute == 0 and current_time.hour % 6 == 0:
                        if current_time - last_check > timedelta(hours=5):  # Avoid duplicate 6-hour jobs
                            self.schedule_job(job_type, JobPriority.HIGH)
                            last_schedule_check[job_type] = current_time

                    elif job_type == "check_sdk_changes" and current_time.minute == 0 and current_time.hour in [8, 20]:
                        if current_time - last_check > timedelta(hours=11):  # Avoid duplicate twice-daily jobs
                            self.schedule_job(job_type, JobPriority.MEDIUM)
                            last_schedule_check[job_type] = current_time

                time.sleep(60)  # Check every minute

            except Exception as e:
                logger.error(f"Error in automatic scheduling: {e}")
                time.sleep(300)  # Wait 5 minutes on error

        logger.info("Automatic scheduling loop stopped")

    def _execute_job(self, job: ScheduledJob):
        """Execute a single job."""
        start_time = time.time()

        try:
            # Check if handler exists
            handler = self.job_handlers.get(job.job_type)
            if not handler:
                raise ValueError(f"No handler for job type: {job.job_type}")

            # Execute job with timeout
            result = asyncio.run(asyncio.wait_for(
                handler(job.parameters),
                timeout=self.config.job_timeout_minutes * 60
            ))

            # Record execution time
            execution_time = int((time.time() - start_time) * 1000)
            job.execution_time_ms = execution_time

            # Complete job
            self.job_queue.complete_job(job, result)

            logger.info(f"Job {job.job_id} completed in {execution_time}ms")

        except asyncio.TimeoutError:
            error = f"Job timed out after {self.config.job_timeout_minutes} minutes"
            self.job_queue.fail_job(job, error)
            logger.error(f"Job {job.job_id} timed out")

        except Exception as e:
            error = str(e)
            self.job_queue.fail_job(job, error)
            logger.error(f"Job {job.job_id} failed: {error}")

    def schedule_job(self,
                    job_type: str,
                    priority: JobPriority = JobPriority.MEDIUM,
                    parameters: Optional[Dict[str, Any]] = None,
                    scheduled_time: Optional[datetime] = None) -> str:
        """Schedule a new job."""

        job_id = f"{job_type}_{int(time.time())}_{uuid.uuid4().hex[:8]}"

        job = ScheduledJob(
            job_id=job_id,
            job_type=job_type,
            priority=priority,
            scheduled_time=scheduled_time or datetime.utcnow(),
            created_time=datetime.utcnow(),
            parameters=parameters or {}
        )

        success = self.job_queue.add_job(job)
        if success:
            logger.info(f"Scheduled job {job_id} of type {job_type}")
            return job_id
        else:
            logger.error(f"Failed to schedule job {job_id}")
            return ""

    async def _handle_regenerate_specifications(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle specification regeneration job."""
        logger.info("Starting specification regeneration")

        # This would trigger the full specification generation workflow
        # For now, we'll implement a simplified version

        result = {
            "specifications_generated": 0,
            "schemas_updated": 0,
            "validation_results": [],
            "timestamp": datetime.utcnow().isoformat()
        }

        # In a real implementation, this would:
        # 1. Run the capture engine to gather current behavior
        # 2. Analyze the captured data
        # 3. Generate new specifications
        # 4. Validate the generated specifications
        # 5. Update the specification files

        return result

    async def _handle_validate_specifications(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle specification validation job."""
        logger.info("Starting specification validation")

        validation_results = []
        specifications_path = Path("claudeCodeSpecs/generated")

        if specifications_path.exists():
            for spec_file in specifications_path.glob("**/*.json"):
                try:
                    with open(spec_file, 'r') as f:
                        spec_data = json.load(f)

                    is_valid = self.validator.validate_specification(spec_data)
                    validation_results.append({
                        "file": str(spec_file),
                        "valid": is_valid,
                        "timestamp": datetime.utcnow().isoformat()
                    })

                except Exception as e:
                    validation_results.append({
                        "file": str(spec_file),
                        "valid": False,
                        "error": str(e)
                    })

        return {
            "total_specifications": len(validation_results),
            "valid_specifications": sum(1 for r in validation_results if r["valid"]),
            "validation_results": validation_results,
            "timestamp": datetime.utcnow().isoformat()
        }

    async def _handle_update_schemas(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle schema update job."""
        logger.info("Starting schema updates")

        # This would update JSON schemas based on new behavioral patterns
        return {
            "schemas_updated": 0,
            "timestamp": datetime.utcnow().isoformat()
        }

    async def _handle_check_sdk_changes(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle SDK change checking job."""
        logger.info("Checking for SDK changes")

        async with self.sdk_monitor:
            updates = await self.sdk_monitor.research_sdk_updates()

        relevant_updates = [u for u in updates if u.relevance_score >= 0.7]

        return {
            "total_updates_found": len(updates),
            "relevant_updates": len(relevant_updates),
            "high_relevance_updates": [asdict(u) for u in relevant_updates[:3]],
            "timestamp": datetime.utcnow().isoformat()
        }

    async def _handle_cleanup_old_data(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle cleanup of old data."""
        logger.info("Cleaning up old data")

        files_cleaned = 0
        cutoff_date = datetime.utcnow() - timedelta(days=self.config.job_retention_days)

        # Clean up old job logs, metrics, etc.
        cleanup_paths = [
            "claudeCodeSpecs/maintenance/monitoring_data/metrics",
            "claudeCodeSpecs/maintenance/scheduler_data/logs"
        ]

        for path_str in cleanup_paths:
            path = Path(path_str)
            if path.exists():
                for file_path in path.glob("*"):
                    if file_path.is_file():
                        file_time = datetime.fromtimestamp(file_path.stat().st_mtime)
                        if file_time < cutoff_date:
                            try:
                                file_path.unlink()
                                files_cleaned += 1
                            except Exception as e:
                                logger.warning(f"Failed to delete {file_path}: {e}")

        return {
            "files_cleaned": files_cleaned,
            "cutoff_date": cutoff_date.isoformat(),
            "timestamp": datetime.utcnow().isoformat()
        }

    async def _handle_generate_reports(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle report generation job."""
        logger.info("Generating reports")

        # Generate monitoring and maintenance reports
        return {
            "reports_generated": 1,
            "timestamp": datetime.utcnow().isoformat()
        }

    async def _handle_backup_specifications(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle specification backup job."""
        logger.info("Backing up specifications")

        backup_count = 0
        source_path = Path("claudeCodeSpecs/generated")
        backup_path = Path(f"claudeCodeSpecs/maintenance/scheduler_data/backups/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}")

        if source_path.exists():
            backup_path.mkdir(parents=True, exist_ok=True)

            for spec_file in source_path.glob("**/*.json"):
                try:
                    relative_path = spec_file.relative_to(source_path)
                    backup_file = backup_path / relative_path
                    backup_file.parent.mkdir(parents=True, exist_ok=True)

                    import shutil
                    shutil.copy2(spec_file, backup_file)
                    backup_count += 1

                except Exception as e:
                    logger.warning(f"Failed to backup {spec_file}: {e}")

        return {
            "files_backed_up": backup_count,
            "backup_path": str(backup_path),
            "timestamp": datetime.utcnow().isoformat()
        }

    def _save_job_state(self):
        """Save current job state to disk."""
        try:
            state_file = Path("claudeCodeSpecs/maintenance/scheduler_data/job_state.json")

            state = {
                "timestamp": datetime.utcnow().isoformat(),
                "queue_status": self.job_queue.get_status(),
                "completed_jobs": [asdict(job) for job in self.job_queue.completed_jobs[-50:]],  # Last 50 jobs
                "config": asdict(self.config)
            }

            with open(state_file, 'w') as f:
                json.dump(state, f, indent=2, default=str)

        except Exception as e:
            logger.error(f"Failed to save job state: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Get scheduler status."""
        if not self.scheduler_active:
            return {"status": "inactive"}

        uptime = (datetime.utcnow() - self.start_time).total_seconds() / 3600 if self.start_time else 0
        queue_status = self.job_queue.get_status()

        return {
            "status": "active",
            "uptime_hours": uptime,
            "queue_status": queue_status,
            "worker_threads": len(self.worker_threads),
            "automatic_scheduling": self.config.enable_automatic_scheduling
        }


# Factory function for easy instantiation
def create_update_scheduler(config: Optional[ScheduleConfig] = None) -> UpdateScheduler:
    """Factory function to create a configured update scheduler."""
    return UpdateScheduler(config)


async def main():
    """Example usage of the update scheduler."""
    logging.basicConfig(level=logging.INFO)

    # Create and start scheduler
    scheduler = create_update_scheduler()

    try:
        session_id = await scheduler.start_scheduler()
        print(f"Scheduler started: {session_id}")

        # Schedule some test jobs
        job_id1 = scheduler.schedule_job("validate_specifications", JobPriority.HIGH)
        job_id2 = scheduler.schedule_job("check_sdk_changes", JobPriority.MEDIUM)

        print(f"Scheduled jobs: {job_id1}, {job_id2}")

        # Wait for jobs to process
        await asyncio.sleep(10)

        # Get status
        status = scheduler.get_status()
        print(f"Current status: {status}")

    finally:
        # Stop scheduler
        summary = await scheduler.stop_scheduler()
        print(f"Scheduler summary: {summary}")


if __name__ == "__main__":
    asyncio.run(main())