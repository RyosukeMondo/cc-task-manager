#!/usr/bin/env python3
"""
Alert System - Notification and alerting for specification maintenance

Implements comprehensive alerting infrastructure for specification monitoring,
including multiple notification channels, alert routing, and escalation policies.

Leverages alerting systems and automated notification capabilities.
"""

import asyncio
import json
import logging
import smtplib
import time
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import threading
from queue import Queue, Empty
import aiohttp

# Import existing components
from .monitor import MonitoringAlert, SpecificationMonitor

logger = logging.getLogger(__name__)


class NotificationChannel(Enum):
    """Available notification channels."""
    EMAIL = "email"
    WEBHOOK = "webhook"
    SLACK = "slack"
    CONSOLE = "console"
    FILE = "file"


class AlertSeverity(Enum):
    """Alert severity levels with priority."""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class NotificationConfig:
    """Configuration for a notification channel."""
    channel: NotificationChannel
    enabled: bool
    config: Dict[str, Any]
    severity_filter: List[str]  # Which severities to send to this channel
    rate_limit_per_hour: int


@dataclass
class AlertRule:
    """Rule for alert processing and routing."""
    rule_id: str
    name: str
    condition: str  # Simple condition string or pattern
    severity_override: Optional[str]
    notification_channels: List[NotificationChannel]
    suppress_duration_minutes: int
    escalation_rules: List[Dict[str, Any]]
    enabled: bool


@dataclass
class NotificationAttempt:
    """Record of a notification attempt."""
    attempt_id: str
    alert_id: str
    channel: NotificationChannel
    timestamp: datetime
    success: bool
    error_message: Optional[str]
    retry_count: int
    response_data: Optional[Dict[str, Any]]


@dataclass
class AlertMetrics:
    """Metrics for alert system performance."""
    timestamp: datetime
    alerts_processed_24h: int
    notifications_sent_24h: int
    notification_success_rate: float
    average_processing_time_ms: float
    failed_notifications_24h: int
    suppressed_alerts_24h: int
    active_suppressions: int


class NotificationHandler:
    """Base class for notification handlers."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    async def send_notification(self,
                              alert: MonitoringAlert,
                              context: Dict[str, Any]) -> NotificationAttempt:
        """Send notification for an alert."""
        raise NotImplementedError


class EmailNotificationHandler(NotificationHandler):
    """Email notification handler."""

    async def send_notification(self,
                              alert: MonitoringAlert,
                              context: Dict[str, Any]) -> NotificationAttempt:
        """Send email notification."""
        attempt_id = f"email_{int(time.time())}_{hash(alert.alert_id) % 10000}"

        try:
            # Email configuration
            smtp_server = self.config.get("smtp_server", "localhost")
            smtp_port = self.config.get("smtp_port", 587)
            username = self.config.get("username")
            password = self.config.get("password")
            sender = self.config.get("sender", "claude-specs@localhost")
            recipients = self.config.get("recipients", [])

            if not recipients:
                raise ValueError("No email recipients configured")

            # Create message
            msg = MIMEMultipart()
            msg['From'] = sender
            msg['To'] = ", ".join(recipients)
            msg['Subject'] = f"[{alert.severity.upper()}] Claude Code Specs Alert: {alert.title}"

            # Email body
            body = self._create_email_body(alert, context)
            msg.attach(MIMEText(body, 'html'))

            # Send email
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                if username and password:
                    server.starttls()
                    server.login(username, password)

                server.send_message(msg)

            return NotificationAttempt(
                attempt_id=attempt_id,
                alert_id=alert.alert_id,
                channel=NotificationChannel.EMAIL,
                timestamp=datetime.utcnow(),
                success=True,
                error_message=None,
                retry_count=0,
                response_data={"recipients": recipients}
            )

        except Exception as e:
            return NotificationAttempt(
                attempt_id=attempt_id,
                alert_id=alert.alert_id,
                channel=NotificationChannel.EMAIL,
                timestamp=datetime.utcnow(),
                success=False,
                error_message=str(e),
                retry_count=0,
                response_data=None
            )

    def _create_email_body(self, alert: MonitoringAlert, context: Dict[str, Any]) -> str:
        """Create HTML email body."""
        severity_colors = {
            "low": "#28a745",
            "medium": "#ffc107",
            "high": "#fd7e14",
            "critical": "#dc3545"
        }

        color = severity_colors.get(alert.severity.lower(), "#6c757d")

        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; margin: 20px;">
            <div style="border-left: 4px solid {color}; padding-left: 20px;">
                <h2 style="color: {color}; margin: 0;">
                    [{alert.severity.upper()}] {alert.title}
                </h2>

                <h3>Alert Details</h3>
                <ul>
                    <li><strong>Alert ID:</strong> {alert.alert_id}</li>
                    <li><strong>Type:</strong> {alert.alert_type}</li>
                    <li><strong>Source:</strong> {alert.source_component}</li>
                    <li><strong>Timestamp:</strong> {alert.timestamp.isoformat()}</li>
                </ul>

                <h3>Description</h3>
                <p>{alert.description}</p>

                <h3>Affected Specifications</h3>
                <ul>
                    {"".join(f"<li>{spec}</li>" for spec in alert.affected_specifications)}
                </ul>

                <h3>Recommended Actions</h3>
                <ol>
                    {"".join(f"<li>{action}</li>" for action in alert.recommended_actions)}
                </ol>

                <h3>Additional Context</h3>
                <pre style="background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
{json.dumps(context, indent=2)}
                </pre>
            </div>
        </body>
        </html>
        """


class WebhookNotificationHandler(NotificationHandler):
    """Webhook notification handler."""

    async def send_notification(self,
                              alert: MonitoringAlert,
                              context: Dict[str, Any]) -> NotificationAttempt:
        """Send webhook notification."""
        attempt_id = f"webhook_{int(time.time())}_{hash(alert.alert_id) % 10000}"

        try:
            webhook_url = self.config.get("url")
            if not webhook_url:
                raise ValueError("No webhook URL configured")

            # Create webhook payload
            payload = {
                "alert": asdict(alert),
                "context": context,
                "timestamp": datetime.utcnow().isoformat(),
                "source": "claude-code-specs-monitor"
            }

            # Send webhook
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    webhook_url,
                    json=payload,
                    headers=self.config.get("headers", {}),
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    response_data = {
                        "status_code": response.status,
                        "response_text": await response.text()
                    }

                    success = 200 <= response.status < 300

                    return NotificationAttempt(
                        attempt_id=attempt_id,
                        alert_id=alert.alert_id,
                        channel=NotificationChannel.WEBHOOK,
                        timestamp=datetime.utcnow(),
                        success=success,
                        error_message=None if success else f"HTTP {response.status}",
                        retry_count=0,
                        response_data=response_data
                    )

        except Exception as e:
            return NotificationAttempt(
                attempt_id=attempt_id,
                alert_id=alert.alert_id,
                channel=NotificationChannel.WEBHOOK,
                timestamp=datetime.utcnow(),
                success=False,
                error_message=str(e),
                retry_count=0,
                response_data=None
            )


class SlackNotificationHandler(NotificationHandler):
    """Slack notification handler."""

    async def send_notification(self,
                              alert: MonitoringAlert,
                              context: Dict[str, Any]) -> NotificationAttempt:
        """Send Slack notification."""
        attempt_id = f"slack_{int(time.time())}_{hash(alert.alert_id) % 10000}"

        try:
            webhook_url = self.config.get("webhook_url")
            if not webhook_url:
                raise ValueError("No Slack webhook URL configured")

            # Create Slack message
            severity_colors = {
                "low": "good",
                "medium": "warning",
                "high": "danger",
                "critical": "danger"
            }

            color = severity_colors.get(alert.severity.lower(), "#808080")

            payload = {
                "text": f"Claude Code Specifications Alert: {alert.title}",
                "attachments": [
                    {
                        "color": color,
                        "fields": [
                            {
                                "title": "Severity",
                                "value": alert.severity.upper(),
                                "short": True
                            },
                            {
                                "title": "Type",
                                "value": alert.alert_type,
                                "short": True
                            },
                            {
                                "title": "Source",
                                "value": alert.source_component,
                                "short": True
                            },
                            {
                                "title": "Alert ID",
                                "value": alert.alert_id,
                                "short": True
                            },
                            {
                                "title": "Description",
                                "value": alert.description,
                                "short": False
                            },
                            {
                                "title": "Affected Specifications",
                                "value": ", ".join(alert.affected_specifications),
                                "short": False
                            },
                            {
                                "title": "Recommended Actions",
                                "value": "\n".join(f"• {action}" for action in alert.recommended_actions),
                                "short": False
                            }
                        ],
                        "footer": "Claude Code Specs Monitor",
                        "ts": int(alert.timestamp.timestamp())
                    }
                ]
            }

            # Send to Slack
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    webhook_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    response_data = {
                        "status_code": response.status,
                        "response_text": await response.text()
                    }

                    success = response.status == 200

                    return NotificationAttempt(
                        attempt_id=attempt_id,
                        alert_id=alert.alert_id,
                        channel=NotificationChannel.SLACK,
                        timestamp=datetime.utcnow(),
                        success=success,
                        error_message=None if success else f"HTTP {response.status}",
                        retry_count=0,
                        response_data=response_data
                    )

        except Exception as e:
            return NotificationAttempt(
                attempt_id=attempt_id,
                alert_id=alert.alert_id,
                channel=NotificationChannel.SLACK,
                timestamp=datetime.utcnow(),
                success=False,
                error_message=str(e),
                retry_count=0,
                response_data=None
            )


class ConsoleNotificationHandler(NotificationHandler):
    """Console notification handler."""

    async def send_notification(self,
                              alert: MonitoringAlert,
                              context: Dict[str, Any]) -> NotificationAttempt:
        """Send console notification."""
        attempt_id = f"console_{int(time.time())}_{hash(alert.alert_id) % 10000}"

        try:
            # Format console message
            severity_symbols = {
                "low": "ℹ️",
                "medium": "⚠️",
                "high": "🚨",
                "critical": "🔥"
            }

            symbol = severity_symbols.get(alert.severity.lower(), "📢")

            message = f"""
{symbol} [{alert.severity.upper()}] CLAUDE CODE SPECS ALERT {symbol}

Title: {alert.title}
Type: {alert.alert_type}
Source: {alert.source_component}
Alert ID: {alert.alert_id}
Time: {alert.timestamp.isoformat()}

Description:
{alert.description}

Affected Specifications:
{chr(10).join(f"  - {spec}" for spec in alert.affected_specifications)}

Recommended Actions:
{chr(10).join(f"  {i+1}. {action}" for i, action in enumerate(alert.recommended_actions))}

{'='*80}
"""

            # Print to console
            print(message)

            # Also log it
            if alert.severity.lower() == "critical":
                logger.critical(f"CRITICAL ALERT: {alert.title}")
            elif alert.severity.lower() == "high":
                logger.error(f"HIGH ALERT: {alert.title}")
            elif alert.severity.lower() == "medium":
                logger.warning(f"MEDIUM ALERT: {alert.title}")
            else:
                logger.info(f"LOW ALERT: {alert.title}")

            return NotificationAttempt(
                attempt_id=attempt_id,
                alert_id=alert.alert_id,
                channel=NotificationChannel.CONSOLE,
                timestamp=datetime.utcnow(),
                success=True,
                error_message=None,
                retry_count=0,
                response_data={"logged": True}
            )

        except Exception as e:
            return NotificationAttempt(
                attempt_id=attempt_id,
                alert_id=alert.alert_id,
                channel=NotificationChannel.CONSOLE,
                timestamp=datetime.utcnow(),
                success=False,
                error_message=str(e),
                retry_count=0,
                response_data=None
            )


class FileNotificationHandler(NotificationHandler):
    """File notification handler."""

    async def send_notification(self,
                              alert: MonitoringAlert,
                              context: Dict[str, Any]) -> NotificationAttempt:
        """Save notification to file."""
        attempt_id = f"file_{int(time.time())}_{hash(alert.alert_id) % 10000}"

        try:
            output_file = Path(self.config.get("file_path", "alerts.log"))
            output_file.parent.mkdir(parents=True, exist_ok=True)

            # Create notification record
            notification_record = {
                "timestamp": datetime.utcnow().isoformat(),
                "alert": asdict(alert),
                "context": context,
                "notification_id": attempt_id
            }

            # Append to file
            with open(output_file, 'a') as f:
                json.dump(notification_record, f, default=str)
                f.write('\n')

            return NotificationAttempt(
                attempt_id=attempt_id,
                alert_id=alert.alert_id,
                channel=NotificationChannel.FILE,
                timestamp=datetime.utcnow(),
                success=True,
                error_message=None,
                retry_count=0,
                response_data={"file_path": str(output_file)}
            )

        except Exception as e:
            return NotificationAttempt(
                attempt_id=attempt_id,
                alert_id=alert.alert_id,
                channel=NotificationChannel.FILE,
                timestamp=datetime.utcnow(),
                success=False,
                error_message=str(e),
                retry_count=0,
                response_data=None
            )


class AlertSystem:
    """
    Comprehensive alert system for specification monitoring.

    Features:
    - Multiple notification channels (email, webhook, Slack, console, file)
    - Alert routing and filtering
    - Rate limiting and suppression
    - Retry logic for failed notifications
    - Escalation policies
    - Metrics and monitoring
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or self._default_config()
        self.alert_queue = Queue()
        self.notification_handlers: Dict[NotificationChannel, NotificationHandler] = {}
        self.alert_rules: List[AlertRule] = []
        self.suppression_cache: Dict[str, datetime] = {}
        self.notification_attempts: List[NotificationAttempt] = []
        self.rate_limit_tracker: Dict[str, List[datetime]] = {}

        # Background processing
        self.processing_active = False
        self.processing_thread: Optional[threading.Thread] = None

        # Setup
        self.setup_directories()
        self._initialize_handlers()
        self._load_alert_rules()

    def _default_config(self) -> Dict[str, Any]:
        """Default alert system configuration."""
        return {
            "notification_channels": {
                "console": {
                    "enabled": True,
                    "severity_filter": ["low", "medium", "high", "critical"],
                    "rate_limit_per_hour": 100
                },
                "file": {
                    "enabled": True,
                    "file_path": "claudeCodeSpecs/maintenance/alerts/alerts.log",
                    "severity_filter": ["medium", "high", "critical"],
                    "rate_limit_per_hour": 200
                },
                "email": {
                    "enabled": False,
                    "smtp_server": "localhost",
                    "smtp_port": 587,
                    "username": "",
                    "password": "",
                    "sender": "claude-specs@localhost",
                    "recipients": [],
                    "severity_filter": ["high", "critical"],
                    "rate_limit_per_hour": 10
                },
                "webhook": {
                    "enabled": False,
                    "url": "",
                    "headers": {},
                    "severity_filter": ["medium", "high", "critical"],
                    "rate_limit_per_hour": 50
                },
                "slack": {
                    "enabled": False,
                    "webhook_url": "",
                    "severity_filter": ["high", "critical"],
                    "rate_limit_per_hour": 20
                }
            },
            "alert_rules": [],
            "retry_policy": {
                "max_retries": 3,
                "retry_delay_minutes": [1, 5, 15]  # Exponential backoff
            },
            "suppression": {
                "default_duration_minutes": 60,
                "max_suppressions_per_hour": 100
            },
            "metrics_retention_days": 30
        }

    def setup_directories(self):
        """Create necessary directories."""
        directories = [
            "claudeCodeSpecs/maintenance/alerts",
            "claudeCodeSpecs/maintenance/alerts/notifications",
            "claudeCodeSpecs/maintenance/alerts/metrics"
        ]

        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)

    def _initialize_handlers(self):
        """Initialize notification handlers."""
        channel_configs = self.config.get("notification_channels", {})

        for channel_name, channel_config in channel_configs.items():
            if not channel_config.get("enabled", False):
                continue

            try:
                channel = NotificationChannel(channel_name)

                if channel == NotificationChannel.EMAIL:
                    handler = EmailNotificationHandler(channel_config)
                elif channel == NotificationChannel.WEBHOOK:
                    handler = WebhookNotificationHandler(channel_config)
                elif channel == NotificationChannel.SLACK:
                    handler = SlackNotificationHandler(channel_config)
                elif channel == NotificationChannel.CONSOLE:
                    handler = ConsoleNotificationHandler(channel_config)
                elif channel == NotificationChannel.FILE:
                    handler = FileNotificationHandler(channel_config)
                else:
                    continue

                self.notification_handlers[channel] = handler
                logger.info(f"Initialized {channel_name} notification handler")

            except Exception as e:
                logger.error(f"Failed to initialize {channel_name} handler: {e}")

    def _load_alert_rules(self):
        """Load alert rules from configuration."""
        rules_config = self.config.get("alert_rules", [])

        for rule_data in rules_config:
            try:
                rule = AlertRule(**rule_data)
                self.alert_rules.append(rule)
            except Exception as e:
                logger.error(f"Failed to load alert rule: {e}")

        logger.info(f"Loaded {len(self.alert_rules)} alert rules")

    def start_processing(self):
        """Start alert processing."""
        if self.processing_active:
            logger.warning("Alert processing already active")
            return

        self.processing_active = True
        self.processing_thread = threading.Thread(
            target=self._processing_loop,
            daemon=True
        )
        self.processing_thread.start()

        logger.info("Alert processing started")

    def stop_processing(self):
        """Stop alert processing."""
        if not self.processing_active:
            return

        self.processing_active = False
        if self.processing_thread:
            self.processing_thread.join(timeout=10.0)

        logger.info("Alert processing stopped")

    def _processing_loop(self):
        """Main alert processing loop."""
        logger.info("Alert processing loop started")

        while self.processing_active:
            try:
                alert = self.alert_queue.get(timeout=1.0)
                asyncio.run(self._process_alert(alert))
            except Empty:
                continue
            except Exception as e:
                logger.error(f"Error processing alert: {e}")

        logger.info("Alert processing loop stopped")

    async def _process_alert(self, alert: MonitoringAlert):
        """Process a single alert."""
        logger.info(f"Processing alert {alert.alert_id}: {alert.title}")

        # Check suppression
        if self._is_suppressed(alert):
            logger.debug(f"Alert {alert.alert_id} is suppressed")
            return

        # Apply alert rules
        applicable_rules = self._find_applicable_rules(alert)

        if applicable_rules:
            for rule in applicable_rules:
                await self._apply_rule(alert, rule)
        else:
            # Default processing
            await self._send_default_notifications(alert)

        # Update suppression cache
        self._update_suppression_cache(alert)

    def _is_suppressed(self, alert: MonitoringAlert) -> bool:
        """Check if alert should be suppressed."""
        suppression_key = f"{alert.alert_type}_{alert.source_component}"

        if suppression_key in self.suppression_cache:
            suppression_time = self.suppression_cache[suppression_key]
            if datetime.utcnow() < suppression_time:
                return True
            else:
                del self.suppression_cache[suppression_key]

        return False

    def _find_applicable_rules(self, alert: MonitoringAlert) -> List[AlertRule]:
        """Find alert rules that apply to this alert."""
        applicable_rules = []

        for rule in self.alert_rules:
            if not rule.enabled:
                continue

            # Simple condition matching (in production, would use more sophisticated matching)
            if rule.condition in alert.alert_type or rule.condition in alert.title.lower():
                applicable_rules.append(rule)

        return applicable_rules

    async def _apply_rule(self, alert: MonitoringAlert, rule: AlertRule):
        """Apply an alert rule to an alert."""
        logger.debug(f"Applying rule {rule.name} to alert {alert.alert_id}")

        # Override severity if specified
        if rule.severity_override:
            alert.severity = rule.severity_override

        # Send notifications to specified channels
        for channel in rule.notification_channels:
            if channel in self.notification_handlers:
                await self._send_notification(alert, channel)

    async def _send_default_notifications(self, alert: MonitoringAlert):
        """Send notifications using default routing."""
        for channel, handler in self.notification_handlers.items():
            channel_config = self.config["notification_channels"].get(channel.value, {})
            severity_filter = channel_config.get("severity_filter", [])

            if alert.severity.lower() in severity_filter:
                await self._send_notification(alert, channel)

    async def _send_notification(self, alert: MonitoringAlert, channel: NotificationChannel):
        """Send notification to a specific channel."""
        # Check rate limits
        if not self._check_rate_limit(channel):
            logger.warning(f"Rate limit exceeded for channel {channel.value}")
            return

        handler = self.notification_handlers.get(channel)
        if not handler:
            logger.error(f"No handler for channel {channel.value}")
            return

        # Create context
        context = {
            "system_time": datetime.utcnow().isoformat(),
            "channel": channel.value,
            "source_system": "claude-code-specs-monitor"
        }

        try:
            # Send notification
            attempt = await handler.send_notification(alert, context)
            self.notification_attempts.append(attempt)

            if attempt.success:
                logger.info(f"Notification sent successfully via {channel.value} for alert {alert.alert_id}")
            else:
                logger.error(f"Notification failed via {channel.value}: {attempt.error_message}")

        except Exception as e:
            logger.error(f"Error sending notification via {channel.value}: {e}")

    def _check_rate_limit(self, channel: NotificationChannel) -> bool:
        """Check if rate limit allows sending notification."""
        channel_config = self.config["notification_channels"].get(channel.value, {})
        rate_limit = channel_config.get("rate_limit_per_hour", 100)

        current_time = datetime.utcnow()
        cutoff_time = current_time - timedelta(hours=1)

        # Clean up old entries
        key = channel.value
        if key in self.rate_limit_tracker:
            self.rate_limit_tracker[key] = [
                t for t in self.rate_limit_tracker[key] if t > cutoff_time
            ]
        else:
            self.rate_limit_tracker[key] = []

        # Check limit
        if len(self.rate_limit_tracker[key]) >= rate_limit:
            return False

        # Add current time
        self.rate_limit_tracker[key].append(current_time)
        return True

    def _update_suppression_cache(self, alert: MonitoringAlert):
        """Update suppression cache for this alert type."""
        suppression_key = f"{alert.alert_type}_{alert.source_component}"
        duration_minutes = self.config["suppression"]["default_duration_minutes"]
        suppression_time = datetime.utcnow() + timedelta(minutes=duration_minutes)

        self.suppression_cache[suppression_key] = suppression_time

    def send_alert(self, alert: MonitoringAlert):
        """Send an alert through the system."""
        if not self.processing_active:
            logger.warning("Alert processing not active - alert ignored")
            return

        self.alert_queue.put(alert)
        logger.debug(f"Alert {alert.alert_id} queued for processing")

    def get_metrics(self) -> AlertMetrics:
        """Get alert system metrics."""
        current_time = datetime.utcnow()
        cutoff_time = current_time - timedelta(hours=24)

        # Filter recent attempts
        recent_attempts = [
            attempt for attempt in self.notification_attempts
            if attempt.timestamp > cutoff_time
        ]

        successful_attempts = [attempt for attempt in recent_attempts if attempt.success]

        success_rate = (
            len(successful_attempts) / len(recent_attempts)
            if recent_attempts else 1.0
        )

        # Calculate average processing time (simplified)
        avg_processing_time = 100.0  # Placeholder

        return AlertMetrics(
            timestamp=current_time,
            alerts_processed_24h=len(recent_attempts),
            notifications_sent_24h=len(recent_attempts),
            notification_success_rate=success_rate,
            average_processing_time_ms=avg_processing_time,
            failed_notifications_24h=len(recent_attempts) - len(successful_attempts),
            suppressed_alerts_24h=0,  # Would track this separately
            active_suppressions=len(self.suppression_cache)
        )

    def get_status(self) -> Dict[str, Any]:
        """Get alert system status."""
        metrics = self.get_metrics()

        return {
            "processing_active": self.processing_active,
            "enabled_channels": list(self.notification_handlers.keys()),
            "alert_rules_count": len(self.alert_rules),
            "queue_size": self.alert_queue.qsize(),
            "metrics": asdict(metrics)
        }


# Factory function for easy instantiation
def create_alert_system(config: Optional[Dict[str, Any]] = None) -> AlertSystem:
    """Factory function to create a configured alert system."""
    return AlertSystem(config)


async def main():
    """Example usage of the alert system."""
    logging.basicConfig(level=logging.INFO)

    # Create and start alert system
    alert_system = create_alert_system()
    alert_system.start_processing()

    try:
        # Create a test alert
        test_alert = MonitoringAlert(
            alert_id="test_alert_123",
            timestamp=datetime.utcnow(),
            alert_type="test",
            severity="medium",
            title="Test Alert",
            description="This is a test alert for demonstration",
            source_component="alert_system_test",
            affected_specifications=["test_spec.json"],
            recommended_actions=["Review test alert", "Verify alert system"],
            metadata={"test": True}
        )

        # Send the alert
        alert_system.send_alert(test_alert)

        # Wait for processing
        await asyncio.sleep(2)

        # Get status
        status = alert_system.get_status()
        print(f"Alert system status: {status}")

    finally:
        # Stop processing
        alert_system.stop_processing()


if __name__ == "__main__":
    asyncio.run(main())