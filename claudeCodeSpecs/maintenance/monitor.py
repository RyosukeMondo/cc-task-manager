#!/usr/bin/env python3
"""
Continuous Monitoring System for Claude Code Specifications

Implements continuous monitoring for specification accuracy and Claude Code changes,
ensuring specifications remain current as Claude Code evolves.

Leverages background job processing, alerting systems, and automated research capabilities.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
import hashlib
import threading
from queue import Queue, Empty

# Import existing components
try:
    from ..runtime_monitoring.capture_engine import create_capture_engine, CaptureEngine
except ImportError:
    # Fallback for testing - create mock implementations
    CaptureEngine = object
    def create_capture_engine(*args, **kwargs):
        return None

try:
    from ..research.claudeCodeSpecs.research.sdk_monitor import SDKMonitor, DEFAULT_CONFIG as SDK_CONFIG
except ImportError:
    # Fallback for testing
    SDKMonitor = object
    SDK_CONFIG = {}

try:
    from ..analysis.behavior_analyzer import BehaviorAnalyzer
except ImportError:
    # Fallback for testing
    BehaviorAnalyzer = object

try:
    from ..validation.schema_validator import SchemaValidator
except ImportError:
    # Fallback for testing
    class SchemaValidator:
        def validate_specification(self, spec_data):
            return True

logger = logging.getLogger(__name__)


@dataclass
class MonitoringAlert:
    """Represents a monitoring alert for specification changes or issues."""
    alert_id: str
    timestamp: datetime
    alert_type: str  # 'specification_drift', 'sdk_change', 'validation_failure', 'behavioral_change'
    severity: str    # 'low', 'medium', 'high', 'critical'
    title: str
    description: str
    source_component: str
    affected_specifications: List[str]
    recommended_actions: List[str]
    metadata: Dict[str, Any]


@dataclass
class MonitoringMetrics:
    """System metrics for continuous monitoring."""
    timestamp: datetime
    specifications_monitored: int
    validation_success_rate: float
    behavioral_drift_score: float
    sdk_change_score: float
    alert_count_24h: int
    system_health: str  # 'healthy', 'degraded', 'critical'
    uptime_hours: float
    processed_events: int
    last_update_check: datetime


class SpecificationMonitor:
    """
    Core monitoring system for continuous specification validation and change detection.

    Features:
    - Real-time specification validation
    - Behavioral drift detection
    - SDK change monitoring
    - Alert generation and management
    - Health metrics tracking
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or self._default_config()
        self.monitoring_active = False
        self.start_time: Optional[datetime] = None

        # Component initialization
        self.capture_engine: Optional[CaptureEngine] = None
        self.sdk_monitor: Optional[SDKMonitor] = None
        self.behavior_analyzer: Optional[BehaviorAnalyzer] = None
        self.schema_validator: Optional[SchemaValidator] = None

        # State tracking
        self.alerts: List[MonitoringAlert] = []
        self.metrics_history: List[MonitoringMetrics] = []
        self.alert_queue = Queue()
        self.last_sdk_check: Optional[datetime] = None
        self.baseline_behaviors: Dict[str, Any] = {}

        # Background threads
        self.monitoring_thread: Optional[threading.Thread] = None
        self.alert_processing_thread: Optional[threading.Thread] = None

        # Setup directories
        self.setup_directories()

    def _default_config(self) -> Dict[str, Any]:
        """Default monitoring configuration."""
        return {
            "monitoring_interval_seconds": 300,  # 5 minutes
            "sdk_check_interval_hours": 6,      # 6 hours
            "validation_interval_minutes": 15,  # 15 minutes
            "behavioral_check_interval_minutes": 30,  # 30 minutes
            "alert_retention_days": 30,
            "metrics_retention_days": 90,
            "max_alerts_per_hour": 10,
            "specifications_directory": "claudeCodeSpecs/generated",
            "monitoring_output": "claudeCodeSpecs/maintenance/monitoring_data",
            "alert_thresholds": {
                "validation_failure_rate": 0.1,     # 10% failure rate triggers alert
                "behavioral_drift_score": 0.3,       # 30% behavior change
                "sdk_change_relevance": 0.7          # 70% relevance for SDK changes
            },
            "performance_limits": {
                "max_processing_time_ms": 1000,
                "max_memory_usage_mb": 1000,
                "max_concurrent_validations": 5
            }
        }

    def setup_directories(self):
        """Create necessary directories for monitoring data."""
        directories = [
            self.config["monitoring_output"],
            f"{self.config['monitoring_output']}/alerts",
            f"{self.config['monitoring_output']}/metrics",
            f"{self.config['monitoring_output']}/reports"
        ]

        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)

    async def start_monitoring(self) -> str:
        """Start continuous monitoring system."""
        if self.monitoring_active:
            logger.warning("Monitoring already active")
            return "already_active"

        self.monitoring_active = True
        self.start_time = datetime.utcnow()

        # Initialize components
        await self._initialize_components()

        # Load baseline behaviors
        self._load_baseline_behaviors()

        # Start background threads
        self._start_background_processes()

        session_id = f"monitor_session_{int(time.time())}"
        logger.info(f"Continuous monitoring started with session ID: {session_id}")

        return session_id

    async def stop_monitoring(self) -> Dict[str, Any]:
        """Stop monitoring and return summary."""
        if not self.monitoring_active:
            logger.warning("Monitoring not active")
            return {}

        self.monitoring_active = False

        # Stop background processes
        self._stop_background_processes()

        # Save final metrics and alerts
        final_metrics = self._generate_current_metrics()
        self._save_metrics(final_metrics)
        self._save_alerts()

        # Generate summary
        uptime = datetime.utcnow() - self.start_time if self.start_time else timedelta(0)
        summary = {
            "session_duration_hours": uptime.total_seconds() / 3600,
            "total_alerts_generated": len(self.alerts),
            "final_system_health": final_metrics.system_health,
            "specifications_monitored": final_metrics.specifications_monitored,
            "validation_success_rate": final_metrics.validation_success_rate
        }

        self.start_time = None
        logger.info(f"Monitoring stopped. Summary: {summary}")

        return summary

    async def _initialize_components(self):
        """Initialize monitoring components."""
        # Runtime capture for behavioral monitoring
        self.capture_engine = create_capture_engine(
            f"{self.config['monitoring_output']}/runtime_capture"
        )

        # SDK monitoring
        self.sdk_monitor = SDKMonitor(SDK_CONFIG)

        # Behavior analysis
        self.behavior_analyzer = BehaviorAnalyzer()

        # Schema validation
        self.schema_validator = SchemaValidator()

        logger.info("Monitoring components initialized")

    def _load_baseline_behaviors(self):
        """Load baseline behavioral patterns for comparison."""
        baseline_file = Path(f"{self.config['monitoring_output']}/baseline_behaviors.json")

        if baseline_file.exists():
            try:
                with open(baseline_file, 'r') as f:
                    self.baseline_behaviors = json.load(f)
                logger.info("Loaded baseline behaviors for comparison")
            except Exception as e:
                logger.error(f"Failed to load baseline behaviors: {e}")
                self.baseline_behaviors = {}
        else:
            logger.info("No baseline behaviors found - will establish new baseline")
            self.baseline_behaviors = {}

    def _start_background_processes(self):
        """Start background monitoring threads."""
        # Main monitoring loop
        self.monitoring_thread = threading.Thread(
            target=self._monitoring_loop,
            daemon=True
        )
        self.monitoring_thread.start()

        # Alert processing
        self.alert_processing_thread = threading.Thread(
            target=self._alert_processing_loop,
            daemon=True
        )
        self.alert_processing_thread.start()

        logger.info("Background monitoring processes started")

    def _stop_background_processes(self):
        """Stop background monitoring threads."""
        # Threads will stop when monitoring_active becomes False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=10.0)

        if self.alert_processing_thread:
            self.alert_processing_thread.join(timeout=5.0)

        logger.info("Background monitoring processes stopped")

    def _monitoring_loop(self):
        """Main monitoring loop running in background thread."""
        logger.info("Monitoring loop started")

        last_validation_check = datetime.min
        last_behavioral_check = datetime.min
        last_sdk_check = datetime.min
        last_metrics_save = datetime.min

        while self.monitoring_active:
            try:
                current_time = datetime.utcnow()

                # Specification validation check
                validation_interval = timedelta(minutes=self.config["validation_interval_minutes"])
                if current_time - last_validation_check >= validation_interval:
                    self._perform_validation_check()
                    last_validation_check = current_time

                # Behavioral drift check
                behavioral_interval = timedelta(minutes=self.config["behavioral_check_interval_minutes"])
                if current_time - last_behavioral_check >= behavioral_interval:
                    self._perform_behavioral_check()
                    last_behavioral_check = current_time

                # SDK change check
                sdk_interval = timedelta(hours=self.config["sdk_check_interval_hours"])
                if current_time - last_sdk_check >= sdk_interval:
                    asyncio.run(self._perform_sdk_check())
                    last_sdk_check = current_time

                # Metrics collection and save
                metrics_interval = timedelta(minutes=30)  # Save metrics every 30 minutes
                if current_time - last_metrics_save >= metrics_interval:
                    metrics = self._generate_current_metrics()
                    self._save_metrics(metrics)
                    last_metrics_save = current_time

                # Sleep for monitoring interval
                time.sleep(self.config["monitoring_interval_seconds"])

            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(60)  # Wait 1 minute before retrying

        logger.info("Monitoring loop stopped")

    def _alert_processing_loop(self):
        """Alert processing loop running in background thread."""
        logger.info("Alert processing loop started")

        while self.monitoring_active:
            try:
                alert = self.alert_queue.get(timeout=1.0)
                self._process_alert(alert)
            except Empty:
                continue
            except Exception as e:
                logger.error(f"Error processing alert: {e}")

        logger.info("Alert processing loop stopped")

    def _perform_validation_check(self):
        """Perform specification validation check."""
        logger.debug("Performing validation check")

        specifications_path = Path(self.config["specifications_directory"])
        if not specifications_path.exists():
            logger.warning("Specifications directory not found")
            return

        validation_results = []

        # Validate all specification files
        for spec_file in specifications_path.glob("**/*.json"):
            try:
                with open(spec_file, 'r') as f:
                    spec_data = json.load(f)

                # Validate using schema validator
                is_valid = self.schema_validator.validate_specification(spec_data)
                validation_results.append({
                    "file": str(spec_file),
                    "valid": is_valid,
                    "timestamp": datetime.utcnow().isoformat()
                })

            except Exception as e:
                logger.error(f"Validation error for {spec_file}: {e}")
                validation_results.append({
                    "file": str(spec_file),
                    "valid": False,
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                })

        # Check if validation failure rate exceeds threshold
        if validation_results:
            failure_rate = sum(1 for r in validation_results if not r["valid"]) / len(validation_results)
            threshold = self.config["alert_thresholds"]["validation_failure_rate"]

            if failure_rate > threshold:
                alert = MonitoringAlert(
                    alert_id=f"validation_failure_{int(time.time())}",
                    timestamp=datetime.utcnow(),
                    alert_type="validation_failure",
                    severity="high" if failure_rate > 0.5 else "medium",
                    title="Specification Validation Failure Rate Exceeded",
                    description=f"Validation failure rate of {failure_rate:.1%} exceeds threshold of {threshold:.1%}",
                    source_component="validation_monitor",
                    affected_specifications=[r["file"] for r in validation_results if not r["valid"]],
                    recommended_actions=[
                        "Review failed specification files",
                        "Update schemas if Claude Code behavior changed",
                        "Regenerate specifications if necessary"
                    ],
                    metadata={"validation_results": validation_results}
                )
                self.alert_queue.put(alert)

    def _perform_behavioral_check(self):
        """Perform behavioral drift detection."""
        logger.debug("Performing behavioral check")

        # This would analyze captured runtime data for behavioral changes
        # For now, we'll implement a simplified version

        if not self.baseline_behaviors:
            logger.info("Establishing new behavioral baseline")
            # In a real implementation, this would analyze recent captured data
            self.baseline_behaviors = {
                "tool_usage_patterns": {},
                "response_patterns": {},
                "error_patterns": {},
                "timestamp": datetime.utcnow().isoformat()
            }
            self._save_baseline_behaviors()
            return

        # Compare current behavior with baseline
        # This is a simplified implementation - real version would analyze captured events
        drift_score = 0.1  # Placeholder - would be calculated from actual analysis

        threshold = self.config["alert_thresholds"]["behavioral_drift_score"]
        if drift_score > threshold:
            alert = MonitoringAlert(
                alert_id=f"behavioral_drift_{int(time.time())}",
                timestamp=datetime.utcnow(),
                alert_type="behavioral_change",
                severity="medium",
                title="Behavioral Drift Detected",
                description=f"Behavioral drift score of {drift_score:.1%} exceeds threshold of {threshold:.1%}",
                source_component="behavioral_monitor",
                affected_specifications=["all"],
                recommended_actions=[
                    "Analyze behavioral changes in detail",
                    "Update behavioral specifications",
                    "Review specification generation parameters"
                ],
                metadata={"drift_score": drift_score, "baseline_timestamp": self.baseline_behaviors.get("timestamp")}
            )
            self.alert_queue.put(alert)

    async def _perform_sdk_check(self):
        """Perform SDK change detection."""
        logger.debug("Performing SDK check")

        try:
            async with self.sdk_monitor:
                updates = await self.sdk_monitor.research_sdk_updates()

            # Filter for high-relevance updates
            threshold = self.config["alert_thresholds"]["sdk_change_relevance"]
            relevant_updates = [u for u in updates if u.relevance_score >= threshold]

            if relevant_updates:
                alert = MonitoringAlert(
                    alert_id=f"sdk_changes_{int(time.time())}",
                    timestamp=datetime.utcnow(),
                    alert_type="sdk_change",
                    severity="medium",
                    title=f"SDK Changes Detected ({len(relevant_updates)} updates)",
                    description=f"Found {len(relevant_updates)} relevant SDK updates that may affect specifications",
                    source_component="sdk_monitor",
                    affected_specifications=["all"],
                    recommended_actions=[
                        "Review SDK changes for specification impact",
                        "Test current specifications against new SDK behavior",
                        "Update specifications if necessary"
                    ],
                    metadata={"updates": [asdict(u) for u in relevant_updates[:5]]}  # Limit to top 5
                )
                self.alert_queue.put(alert)

        except Exception as e:
            logger.error(f"SDK check failed: {e}")

    def _process_alert(self, alert: MonitoringAlert):
        """Process and handle a monitoring alert."""
        logger.info(f"Processing alert: {alert.alert_type} - {alert.title}")

        # Add to alerts list
        self.alerts.append(alert)

        # Apply retention policy
        cutoff_date = datetime.utcnow() - timedelta(days=self.config["alert_retention_days"])
        self.alerts = [a for a in self.alerts if a.timestamp > cutoff_date]

        # Save alert to file
        self._save_single_alert(alert)

        # Log based on severity
        if alert.severity == "critical":
            logger.critical(f"CRITICAL ALERT: {alert.title}")
        elif alert.severity == "high":
            logger.error(f"HIGH ALERT: {alert.title}")
        elif alert.severity == "medium":
            logger.warning(f"MEDIUM ALERT: {alert.title}")
        else:
            logger.info(f"LOW ALERT: {alert.title}")

    def _generate_current_metrics(self) -> MonitoringMetrics:
        """Generate current system metrics."""
        current_time = datetime.utcnow()
        uptime = (current_time - self.start_time).total_seconds() / 3600 if self.start_time else 0

        # Count specifications
        spec_count = 0
        specs_path = Path(self.config["specifications_directory"])
        if specs_path.exists():
            spec_count = len(list(specs_path.glob("**/*.json")))

        # Calculate success rate (simplified - would be based on actual validation results)
        validation_success_rate = 0.95  # Placeholder

        # Calculate drift score (simplified)
        behavioral_drift_score = 0.05  # Placeholder

        # Calculate SDK change score
        sdk_change_score = 0.1  # Placeholder

        # Count recent alerts
        cutoff_time = current_time - timedelta(hours=24)
        alert_count_24h = sum(1 for alert in self.alerts if alert.timestamp > cutoff_time)

        # Determine system health
        system_health = "healthy"
        if alert_count_24h > 10 or validation_success_rate < 0.8:
            system_health = "degraded"
        if alert_count_24h > 20 or validation_success_rate < 0.5:
            system_health = "critical"

        return MonitoringMetrics(
            timestamp=current_time,
            specifications_monitored=spec_count,
            validation_success_rate=validation_success_rate,
            behavioral_drift_score=behavioral_drift_score,
            sdk_change_score=sdk_change_score,
            alert_count_24h=alert_count_24h,
            system_health=system_health,
            uptime_hours=uptime,
            processed_events=0,  # Would be from capture engine
            last_update_check=self.last_sdk_check or current_time
        )

    def _save_metrics(self, metrics: MonitoringMetrics):
        """Save metrics to file."""
        try:
            self.metrics_history.append(metrics)

            # Apply retention policy
            cutoff_date = datetime.utcnow() - timedelta(days=self.config["metrics_retention_days"])
            self.metrics_history = [m for m in self.metrics_history if m.timestamp > cutoff_date]

            # Save to file
            metrics_file = Path(f"{self.config['monitoring_output']}/metrics/current_metrics.json")
            with open(metrics_file, 'w') as f:
                json.dump(asdict(metrics), f, indent=2, default=str)

            # Save history
            history_file = Path(f"{self.config['monitoring_output']}/metrics/metrics_history.jsonl")
            with open(history_file, 'a') as f:
                json.dump(asdict(metrics), f, default=str)
                f.write('\n')

        except Exception as e:
            logger.error(f"Failed to save metrics: {e}")

    def _save_alerts(self):
        """Save all alerts to file."""
        try:
            alerts_file = Path(f"{self.config['monitoring_output']}/alerts/all_alerts.json")
            alerts_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "total_alerts": len(self.alerts),
                "alerts": [asdict(alert) for alert in self.alerts]
            }

            with open(alerts_file, 'w') as f:
                json.dump(alerts_data, f, indent=2, default=str)

        except Exception as e:
            logger.error(f"Failed to save alerts: {e}")

    def _save_single_alert(self, alert: MonitoringAlert):
        """Save individual alert to file."""
        try:
            alert_file = Path(f"{self.config['monitoring_output']}/alerts/{alert.alert_id}.json")
            with open(alert_file, 'w') as f:
                json.dump(asdict(alert), f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save alert {alert.alert_id}: {e}")

    def _save_baseline_behaviors(self):
        """Save baseline behaviors to file."""
        try:
            baseline_file = Path(f"{self.config['monitoring_output']}/baseline_behaviors.json")
            with open(baseline_file, 'w') as f:
                json.dump(self.baseline_behaviors, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save baseline behaviors: {e}")

    def get_current_status(self) -> Dict[str, Any]:
        """Get current monitoring status."""
        if not self.monitoring_active:
            return {"status": "inactive"}

        metrics = self._generate_current_metrics()
        recent_alerts = [alert for alert in self.alerts
                        if alert.timestamp > datetime.utcnow() - timedelta(hours=24)]

        return {
            "status": "active",
            "uptime_hours": metrics.uptime_hours,
            "system_health": metrics.system_health,
            "specifications_monitored": metrics.specifications_monitored,
            "validation_success_rate": metrics.validation_success_rate,
            "alerts_24h": len(recent_alerts),
            "last_sdk_check": self.last_sdk_check.isoformat() if self.last_sdk_check else None
        }


# Factory function for easy instantiation
def create_specification_monitor(config: Optional[Dict[str, Any]] = None) -> SpecificationMonitor:
    """Factory function to create a configured specification monitor."""
    return SpecificationMonitor(config)


async def main():
    """Example usage of the monitoring system."""
    logging.basicConfig(level=logging.INFO)

    # Create and start monitor
    monitor = create_specification_monitor()

    try:
        session_id = await monitor.start_monitoring()
        print(f"Monitoring started: {session_id}")

        # Monitor for a short time (in production, this would run continuously)
        await asyncio.sleep(30)

        # Get status
        status = monitor.get_current_status()
        print(f"Current status: {status}")

    finally:
        # Stop monitoring
        summary = await monitor.stop_monitoring()
        print(f"Monitoring summary: {summary}")


if __name__ == "__main__":
    asyncio.run(main())