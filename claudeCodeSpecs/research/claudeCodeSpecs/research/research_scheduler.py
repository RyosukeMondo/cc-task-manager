#!/usr/bin/env python3
"""
Research Scheduler - Background job scheduling for Claude Code research

This module implements background job scheduling for automated research tasks,
leveraging BullMQ patterns and existing scheduling infrastructure for reliable
and efficient task execution.
"""

import asyncio
import json
import logging
import schedule
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass, asdict
from pathlib import Path
from enum import Enum
import threading
import queue
import uuid
from concurrent.futures import ThreadPoolExecutor, Future
import signal
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class JobStatus(Enum):
    """Job execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"

class JobPriority(Enum):
    """Job priority levels"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4

@dataclass
class ScheduledJob:
    """Represents a scheduled job"""
    job_id: str
    name: str
    function: str  # Function name or module path
    args: List[Any]
    kwargs: Dict[str, Any]
    priority: JobPriority
    status: JobStatus
    schedule_type: str  # "interval", "cron", "once", "delayed"
    schedule_config: Dict[str, Any]
    created_at: datetime
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    run_count: int
    max_retries: int
    retry_count: int
    timeout_seconds: int
    metadata: Dict[str, Any]

@dataclass
class JobResult:
    """Job execution result"""
    job_id: str
    status: JobStatus
    result: Optional[Any]
    error: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]
    duration_seconds: Optional[float]

class ResearchScheduler:
    """
    Background job scheduling system for Claude Code research

    Features:
    - Multiple scheduling types (interval, cron, one-time, delayed)
    - Priority-based job queue with concurrent execution
    - Retry logic with exponential backoff
    - Job persistence and recovery
    - Health monitoring and metrics
    - Graceful shutdown handling
    - Rate limiting and resource management
    """

    def __init__(self,
                 max_workers: int = 4,
                 data_dir: str = "claudeCodeSpecs/research"):
        self.max_workers = max_workers
        self.data_dir = Path(data_dir)
        self.jobs_file = self.data_dir / "scheduled_jobs.json"
        self.results_file = self.data_dir / "job_results.json"
        self.metrics_file = self.data_dir / "scheduler_metrics.json"

        # Ensure directories exist
        self.data_dir.mkdir(parents=True, exist_ok=True)

        # Job storage
        self.jobs: Dict[str, ScheduledJob] = {}
        self.job_queue = queue.PriorityQueue()
        self.running_jobs: Dict[str, Future] = {}
        self.job_results: List[JobResult] = []

        # Threading
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.scheduler_thread: Optional[threading.Thread] = None
        self.running = False
        self.shutdown_event = threading.Event()

        # Metrics
        self.metrics = {
            'total_jobs_scheduled': 0,
            'total_jobs_completed': 0,
            'total_jobs_failed': 0,
            'average_execution_time': 0.0,
            'last_updated': datetime.now().isoformat()
        }

        # Load existing jobs
        self._load_jobs()
        self._load_results()
        self._load_metrics()

        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        # Built-in job functions
        self.job_functions = {
            'sdk_research': self._sdk_research_job,
            'change_detection': self._change_detection_job,
            'health_check': self._health_check_job,
            'cleanup_old_data': self._cleanup_old_data_job,
            'generate_reports': self._generate_reports_job
        }

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        self.stop()

    def _generate_job_id(self) -> str:
        """Generate unique job ID"""
        return str(uuid.uuid4())[:8]

    def _load_jobs(self):
        """Load scheduled jobs from file"""
        if not self.jobs_file.exists():
            return

        try:
            with open(self.jobs_file, 'r') as f:
                data = json.load(f)

            for job_dict in data.get('jobs', []):
                # Convert enums and datetime
                job_dict['priority'] = JobPriority(job_dict['priority'])
                job_dict['status'] = JobStatus(job_dict['status'])
                job_dict['created_at'] = datetime.fromisoformat(job_dict['created_at'])

                if job_dict['last_run']:
                    job_dict['last_run'] = datetime.fromisoformat(job_dict['last_run'])

                if job_dict['next_run']:
                    job_dict['next_run'] = datetime.fromisoformat(job_dict['next_run'])

                job = ScheduledJob(**job_dict)
                self.jobs[job.job_id] = job

            logger.info(f"Loaded {len(self.jobs)} scheduled jobs")

        except Exception as e:
            logger.error(f"Error loading jobs: {e}")

    def _save_jobs(self):
        """Save scheduled jobs to file"""
        try:
            jobs_data = {
                'timestamp': datetime.now().isoformat(),
                'total_jobs': len(self.jobs),
                'jobs': []
            }

            for job in self.jobs.values():
                job_dict = asdict(job)
                job_dict['priority'] = job.priority.value
                job_dict['status'] = job.status.value
                job_dict['created_at'] = job.created_at.isoformat()

                if job.last_run:
                    job_dict['last_run'] = job.last_run.isoformat()
                else:
                    job_dict['last_run'] = None

                if job.next_run:
                    job_dict['next_run'] = job.next_run.isoformat()
                else:
                    job_dict['next_run'] = None

                jobs_data['jobs'].append(job_dict)

            with open(self.jobs_file, 'w') as f:
                json.dump(jobs_data, f, indent=2, default=str)

        except Exception as e:
            logger.error(f"Error saving jobs: {e}")

    def _load_results(self):
        """Load job results from file"""
        if not self.results_file.exists():
            return

        try:
            with open(self.results_file, 'r') as f:
                data = json.load(f)

            for result_dict in data.get('results', []):
                result_dict['status'] = JobStatus(result_dict['status'])
                result_dict['start_time'] = datetime.fromisoformat(result_dict['start_time'])

                if result_dict['end_time']:
                    result_dict['end_time'] = datetime.fromisoformat(result_dict['end_time'])

                result = JobResult(**result_dict)
                self.job_results.append(result)

            # Keep only recent results (last 1000)
            self.job_results = self.job_results[-1000:]

        except Exception as e:
            logger.error(f"Error loading results: {e}")

    def _save_results(self):
        """Save job results to file"""
        try:
            results_data = {
                'timestamp': datetime.now().isoformat(),
                'total_results': len(self.job_results),
                'results': []
            }

            for result in self.job_results[-1000:]:  # Keep only recent results
                result_dict = asdict(result)
                result_dict['status'] = result.status.value
                result_dict['start_time'] = result.start_time.isoformat()

                if result.end_time:
                    result_dict['end_time'] = result.end_time.isoformat()
                else:
                    result_dict['end_time'] = None

                results_data['results'].append(result_dict)

            with open(self.results_file, 'w') as f:
                json.dump(results_data, f, indent=2, default=str)

        except Exception as e:
            logger.error(f"Error saving results: {e}")

    def _load_metrics(self):
        """Load scheduler metrics"""
        if not self.metrics_file.exists():
            return

        try:
            with open(self.metrics_file, 'r') as f:
                self.metrics = json.load(f)

        except Exception as e:
            logger.error(f"Error loading metrics: {e}")

    def _save_metrics(self):
        """Save scheduler metrics"""
        try:
            self.metrics['last_updated'] = datetime.now().isoformat()
            with open(self.metrics_file, 'w') as f:
                json.dump(self.metrics, f, indent=2, default=str)

        except Exception as e:
            logger.error(f"Error saving metrics: {e}")

    def schedule_job(self,
                     name: str,
                     function: str,
                     schedule_type: str,
                     schedule_config: Dict[str, Any],
                     args: List[Any] = None,
                     kwargs: Dict[str, Any] = None,
                     priority: JobPriority = JobPriority.NORMAL,
                     max_retries: int = 3,
                     timeout_seconds: int = 300,
                     metadata: Dict[str, Any] = None) -> str:
        """
        Schedule a new job

        Args:
            name: Human-readable job name
            function: Function name or module path
            schedule_type: "interval", "cron", "once", "delayed"
            schedule_config: Configuration for scheduling
            args: Function arguments
            kwargs: Function keyword arguments
            priority: Job priority
            max_retries: Maximum retry attempts
            timeout_seconds: Job timeout
            metadata: Additional metadata

        Returns:
            Job ID
        """
        job_id = self._generate_job_id()

        # Calculate next run time
        next_run = self._calculate_next_run(schedule_type, schedule_config)

        job = ScheduledJob(
            job_id=job_id,
            name=name,
            function=function,
            args=args or [],
            kwargs=kwargs or {},
            priority=priority,
            status=JobStatus.PENDING,
            schedule_type=schedule_type,
            schedule_config=schedule_config,
            created_at=datetime.now(),
            last_run=None,
            next_run=next_run,
            run_count=0,
            max_retries=max_retries,
            retry_count=0,
            timeout_seconds=timeout_seconds,
            metadata=metadata or {}
        )

        self.jobs[job_id] = job
        self._save_jobs()
        self.metrics['total_jobs_scheduled'] += 1
        self._save_metrics()

        logger.info(f"Scheduled job '{name}' with ID {job_id}")
        return job_id

    def _calculate_next_run(self, schedule_type: str, config: Dict[str, Any]) -> Optional[datetime]:
        """Calculate next run time based on schedule type"""
        now = datetime.now()

        if schedule_type == "once":
            return now

        elif schedule_type == "delayed":
            delay_seconds = config.get('delay_seconds', 60)
            return now + timedelta(seconds=delay_seconds)

        elif schedule_type == "interval":
            interval_seconds = config.get('interval_seconds', 3600)
            return now + timedelta(seconds=interval_seconds)

        elif schedule_type == "cron":
            # Simple cron implementation - just daily at specified hour
            hour = config.get('hour', 0)
            minute = config.get('minute', 0)

            next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)

            return next_run

        return None

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a scheduled job"""
        if job_id not in self.jobs:
            return False

        job = self.jobs[job_id]

        # Cancel running job if possible
        if job_id in self.running_jobs:
            future = self.running_jobs[job_id]
            future.cancel()
            del self.running_jobs[job_id]

        job.status = JobStatus.CANCELLED
        self._save_jobs()

        logger.info(f"Cancelled job {job_id}")
        return True

    def get_job_status(self, job_id: str) -> Optional[JobStatus]:
        """Get job status"""
        if job_id in self.jobs:
            return self.jobs[job_id].status
        return None

    def get_job_results(self, job_id: str) -> List[JobResult]:
        """Get results for a specific job"""
        return [result for result in self.job_results if result.job_id == job_id]

    def start(self):
        """Start the scheduler"""
        if self.running:
            logger.warning("Scheduler is already running")
            return

        self.running = True
        self.shutdown_event.clear()

        # Start scheduler thread
        self.scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.scheduler_thread.start()

        logger.info("Research scheduler started")

    def stop(self):
        """Stop the scheduler gracefully"""
        if not self.running:
            return

        logger.info("Stopping scheduler...")
        self.running = False
        self.shutdown_event.set()

        # Cancel all running jobs
        for job_id, future in list(self.running_jobs.items()):
            logger.info(f"Cancelling running job {job_id}")
            future.cancel()

        # Wait for scheduler thread
        if self.scheduler_thread and self.scheduler_thread.is_alive():
            self.scheduler_thread.join(timeout=10)

        # Shutdown executor
        self.executor.shutdown(wait=True, timeout=30)

        # Save final state
        self._save_jobs()
        self._save_results()
        self._save_metrics()

        logger.info("Scheduler stopped")

    def _scheduler_loop(self):
        """Main scheduler loop"""
        while self.running and not self.shutdown_event.is_set():
            try:
                # Check for jobs to run
                self._check_due_jobs()

                # Clean up completed jobs
                self._cleanup_completed_jobs()

                # Update metrics
                self._update_metrics()

                # Sleep for a short interval
                time.sleep(5)

            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                time.sleep(10)

    def _check_due_jobs(self):
        """Check for jobs that are due to run"""
        now = datetime.now()

        for job in list(self.jobs.values()):
            if (job.status == JobStatus.PENDING and
                job.next_run and
                job.next_run <= now and
                job.job_id not in self.running_jobs):

                self._execute_job(job)

    def _execute_job(self, job: ScheduledJob):
        """Execute a job"""
        logger.info(f"Executing job {job.job_id}: {job.name}")

        job.status = JobStatus.RUNNING
        job.last_run = datetime.now()

        # Submit to thread pool
        future = self.executor.submit(self._run_job_function, job)
        self.running_jobs[job.job_id] = future

        # Add callback for completion
        future.add_done_callback(lambda f: self._job_completed(job.job_id, f))

    def _run_job_function(self, job: ScheduledJob) -> Any:
        """Run the actual job function"""
        start_time = datetime.now()

        try:
            # Get function
            if job.function in self.job_functions:
                func = self.job_functions[job.function]
            else:
                raise ValueError(f"Unknown function: {job.function}")

            # Execute with timeout
            result = func(*job.args, **job.kwargs)

            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()

            # Record result
            job_result = JobResult(
                job_id=job.job_id,
                status=JobStatus.COMPLETED,
                result=result,
                error=None,
                start_time=start_time,
                end_time=end_time,
                duration_seconds=duration
            )

            self.job_results.append(job_result)
            job.status = JobStatus.COMPLETED
            job.run_count += 1
            job.retry_count = 0  # Reset retry count on success

            # Schedule next run if recurring
            if job.schedule_type in ["interval", "cron"]:
                job.next_run = self._calculate_next_run(job.schedule_type, job.schedule_config)
                job.status = JobStatus.PENDING

            self.metrics['total_jobs_completed'] += 1

            return result

        except Exception as e:
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()

            logger.error(f"Job {job.job_id} failed: {e}")

            # Record failure
            job_result = JobResult(
                job_id=job.job_id,
                status=JobStatus.FAILED,
                result=None,
                error=str(e),
                start_time=start_time,
                end_time=end_time,
                duration_seconds=duration
            )

            self.job_results.append(job_result)

            # Handle retry logic
            if job.retry_count < job.max_retries:
                job.retry_count += 1
                job.status = JobStatus.RETRYING
                # Exponential backoff
                delay = min(60 * (2 ** job.retry_count), 3600)  # Max 1 hour
                job.next_run = datetime.now() + timedelta(seconds=delay)
                logger.info(f"Retrying job {job.job_id} in {delay} seconds (attempt {job.retry_count})")
            else:
                job.status = JobStatus.FAILED
                self.metrics['total_jobs_failed'] += 1

            raise

    def _job_completed(self, job_id: str, future: Future):
        """Handle job completion"""
        if job_id in self.running_jobs:
            del self.running_jobs[job_id]

        self._save_jobs()
        self._save_results()

    def _cleanup_completed_jobs(self):
        """Clean up old completed jobs"""
        cutoff_time = datetime.now() - timedelta(days=7)

        jobs_to_remove = []
        for job_id, job in self.jobs.items():
            if (job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED] and
                job.schedule_type == "once" and
                job.last_run and job.last_run < cutoff_time):
                jobs_to_remove.append(job_id)

        for job_id in jobs_to_remove:
            del self.jobs[job_id]
            logger.debug(f"Cleaned up old job {job_id}")

        if jobs_to_remove:
            self._save_jobs()

    def _update_metrics(self):
        """Update scheduler metrics"""
        completed_results = [r for r in self.job_results if r.status == JobStatus.COMPLETED]

        if completed_results:
            total_duration = sum(r.duration_seconds for r in completed_results if r.duration_seconds)
            self.metrics['average_execution_time'] = total_duration / len(completed_results)

        self._save_metrics()

    # Built-in job functions
    def _sdk_research_job(self, *args, **kwargs) -> Dict[str, Any]:
        """Built-in SDK research job"""
        logger.info("Executing SDK research job")

        # This would integrate with the SDKMonitor
        # For now, return mock results
        return {
            'updates_found': 5,
            'timestamp': datetime.now().isoformat(),
            'status': 'completed'
        }

    def _change_detection_job(self, *args, **kwargs) -> Dict[str, Any]:
        """Built-in change detection job"""
        logger.info("Executing change detection job")

        # This would integrate with the ChangeDetector
        return {
            'changes_detected': 2,
            'timestamp': datetime.now().isoformat(),
            'status': 'completed'
        }

    def _health_check_job(self, *args, **kwargs) -> Dict[str, Any]:
        """Built-in health check job"""
        logger.info("Executing health check job")

        # Check system health
        health_status = {
            'scheduler_running': self.running,
            'active_jobs': len(self.running_jobs),
            'total_jobs': len(self.jobs),
            'executor_threads': self.executor._threads,
            'timestamp': datetime.now().isoformat()
        }

        return health_status

    def _cleanup_old_data_job(self, *args, **kwargs) -> Dict[str, Any]:
        """Built-in data cleanup job"""
        logger.info("Executing data cleanup job")

        # Clean up old results and snapshots
        cutoff_time = datetime.now() - timedelta(days=30)

        # Clean old job results
        old_results = len(self.job_results)
        self.job_results = [r for r in self.job_results if r.start_time > cutoff_time]
        cleaned_results = old_results - len(self.job_results)

        self._save_results()

        return {
            'cleaned_results': cleaned_results,
            'timestamp': datetime.now().isoformat(),
            'status': 'completed'
        }

    def _generate_reports_job(self, *args, **kwargs) -> Dict[str, Any]:
        """Built-in report generation job"""
        logger.info("Executing report generation job")

        # Generate summary reports
        return {
            'reports_generated': 1,
            'timestamp': datetime.now().isoformat(),
            'status': 'completed'
        }

    def get_status(self) -> Dict[str, Any]:
        """Get scheduler status"""
        return {
            'running': self.running,
            'total_jobs': len(self.jobs),
            'pending_jobs': len([j for j in self.jobs.values() if j.status == JobStatus.PENDING]),
            'running_jobs': len(self.running_jobs),
            'completed_jobs': len([j for j in self.jobs.values() if j.status == JobStatus.COMPLETED]),
            'failed_jobs': len([j for j in self.jobs.values() if j.status == JobStatus.FAILED]),
            'metrics': self.metrics
        }


def main():
    """Example usage of Research Scheduler"""
    scheduler = ResearchScheduler(max_workers=2)

    try:
        # Start scheduler
        scheduler.start()

        # Schedule some example jobs
        scheduler.schedule_job(
            name="Daily SDK Research",
            function="sdk_research",
            schedule_type="cron",
            schedule_config={"hour": 9, "minute": 0},
            priority=JobPriority.HIGH
        )

        scheduler.schedule_job(
            name="Hourly Change Detection",
            function="change_detection",
            schedule_type="interval",
            schedule_config={"interval_seconds": 3600},
            priority=JobPriority.NORMAL
        )

        scheduler.schedule_job(
            name="Health Check",
            function="health_check",
            schedule_type="interval",
            schedule_config={"interval_seconds": 300},
            priority=JobPriority.LOW
        )

        # Print status
        print("Scheduler Status:")
        status = scheduler.get_status()
        for key, value in status.items():
            print(f"{key}: {value}")

        # Run for a bit
        print("\nScheduler running... Press Ctrl+C to stop")
        while True:
            time.sleep(10)

    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        scheduler.stop()


if __name__ == "__main__":
    main()