#!/usr/bin/env python3
"""
Test script for continuous monitoring and maintenance system

Validates the integration of monitor.py, update-scheduler.py, and alert-system.py
to ensure the complete system works correctly together.
"""

import asyncio
import logging
import time
from datetime import datetime
from pathlib import Path

# Import the maintenance system components
from .monitor import create_specification_monitor, MonitoringAlert
from .update_scheduler import create_update_scheduler, JobPriority
from .alert_system import create_alert_system

logger = logging.getLogger(__name__)


async def test_monitoring_system():
    """Test the specification monitoring system."""
    print("🔍 Testing Specification Monitor...")

    try:
        # Create and start monitor
        monitor = create_specification_monitor()
        session_id = await monitor.start_monitoring()

        print(f"  ✅ Monitor started successfully: {session_id}")

        # Let it run for a few seconds
        await asyncio.sleep(3)

        # Check status
        status = monitor.get_current_status()
        print(f"  📊 Monitor status: {status['system_health']}")
        print(f"  📈 Uptime: {status['uptime_hours']:.2f} hours")

        # Stop monitor
        summary = await monitor.stop_monitoring()
        print(f"  ✅ Monitor stopped. Processed: {summary.get('total_events_captured', 0)} events")

        return True

    except Exception as e:
        print(f"  ❌ Monitor test failed: {e}")
        return False


async def test_scheduler_system():
    """Test the update scheduler system."""
    print("📅 Testing Update Scheduler...")

    try:
        # Create and start scheduler
        scheduler = create_update_scheduler()
        session_id = await scheduler.start_scheduler()

        print(f"  ✅ Scheduler started successfully: {session_id}")

        # Schedule test jobs
        job_id1 = scheduler.schedule_job("validate_specifications", JobPriority.HIGH)
        job_id2 = scheduler.schedule_job("check_sdk_changes", JobPriority.MEDIUM)

        print(f"  📋 Scheduled jobs: {job_id1[:16]}..., {job_id2[:16]}...")

        # Wait for jobs to process
        await asyncio.sleep(5)

        # Check status
        status = scheduler.get_status()
        print(f"  📊 Scheduler status: {status['status']}")
        print(f"  🏃 Worker threads: {status['worker_threads']}")
        print(f"  📈 Queue status: {status['queue_status']}")

        # Stop scheduler
        summary = await scheduler.stop_scheduler()
        print(f"  ✅ Scheduler stopped. Jobs processed: {summary.get('jobs_processed', 0)}")

        return True

    except Exception as e:
        print(f"  ❌ Scheduler test failed: {e}")
        return False


async def test_alert_system():
    """Test the alert system."""
    print("🚨 Testing Alert System...")

    try:
        # Create and start alert system
        alert_system = create_alert_system()
        alert_system.start_processing()

        print("  ✅ Alert system started successfully")

        # Create test alerts
        test_alerts = [
            MonitoringAlert(
                alert_id="test_low_alert",
                timestamp=datetime.utcnow(),
                alert_type="test_alert",
                severity="low",
                title="Test Low Priority Alert",
                description="This is a low priority test alert",
                source_component="test_system",
                affected_specifications=["test_spec.json"],
                recommended_actions=["Review test results"],
                metadata={"test": True, "priority": "low"}
            ),
            MonitoringAlert(
                alert_id="test_high_alert",
                timestamp=datetime.utcnow(),
                alert_type="validation_failure",
                severity="high",
                title="Test High Priority Alert",
                description="This is a high priority test alert",
                source_component="test_system",
                affected_specifications=["critical_spec.json"],
                recommended_actions=["Immediate attention required", "Check system logs"],
                metadata={"test": True, "priority": "high"}
            )
        ]

        # Send test alerts
        for alert in test_alerts:
            alert_system.send_alert(alert)
            print(f"  📨 Sent alert: {alert.title}")

        # Wait for processing
        await asyncio.sleep(3)

        # Check status and metrics
        status = alert_system.get_status()
        print(f"  📊 Alert system active: {status['processing_active']}")
        print(f"  📢 Enabled channels: {[ch.value for ch in status['enabled_channels']]}")
        print(f"  📈 Notifications sent: {status['metrics']['notifications_sent_24h']}")
        print(f"  ✅ Success rate: {status['metrics']['notification_success_rate']:.1%}")

        # Stop alert system
        alert_system.stop_processing()
        print("  ✅ Alert system stopped successfully")

        return True

    except Exception as e:
        print(f"  ❌ Alert system test failed: {e}")
        return False


async def test_integration():
    """Test integration between all systems."""
    print("🔗 Testing System Integration...")

    try:
        # Start all systems
        monitor = create_specification_monitor()
        scheduler = create_update_scheduler()
        alert_system = create_alert_system()

        # Start them
        monitor_session = await monitor.start_monitoring()
        scheduler_session = await scheduler.start_scheduler()
        alert_system.start_processing()

        print("  ✅ All systems started")

        # Let them run together
        await asyncio.sleep(5)

        # Create an alert that would typically come from monitoring
        integration_alert = MonitoringAlert(
            alert_id="integration_test_alert",
            timestamp=datetime.utcnow(),
            alert_type="specification_drift",
            severity="medium",
            title="Integration Test - Specification Drift Detected",
            description="This alert simulates a real monitoring scenario",
            source_component="specification_monitor",
            affected_specifications=["protocol_spec.json", "behavior_spec.json"],
            recommended_actions=[
                "Analyze specification drift patterns",
                "Schedule specification regeneration",
                "Validate against current behavior"
            ],
            metadata={"drift_score": 0.25, "integration_test": True}
        )

        # Send alert through the system
        alert_system.send_alert(integration_alert)

        # Schedule a maintenance job in response
        maintenance_job = scheduler.schedule_job(
            "regenerate_specifications",
            JobPriority.HIGH,
            {"trigger": "specification_drift", "alert_id": integration_alert.alert_id}
        )

        print(f"  📨 Integration alert sent: {integration_alert.alert_id}")
        print(f"  📋 Maintenance job scheduled: {maintenance_job[:16]}...")

        # Wait for processing
        await asyncio.sleep(3)

        # Check all systems
        monitor_status = monitor.get_current_status()
        scheduler_status = scheduler.get_status()
        alert_status = alert_system.get_status()

        print(f"  📊 Monitor health: {monitor_status.get('system_health', 'unknown')}")
        print(f"  📊 Scheduler active: {scheduler_status.get('status', 'unknown')}")
        print(f"  📊 Alerts processed: {alert_status['metrics']['alerts_processed_24h']}")

        # Stop all systems
        await monitor.stop_monitoring()
        await scheduler.stop_scheduler()
        alert_system.stop_processing()

        print("  ✅ Integration test completed successfully")
        return True

    except Exception as e:
        print(f"  ❌ Integration test failed: {e}")
        return False


async def test_file_structure():
    """Test that all necessary files and directories are created."""
    print("📁 Testing File Structure...")

    try:
        # Check main files exist
        main_files = [
            "claudeCodeSpecs/maintenance/monitor.py",
            "claudeCodeSpecs/maintenance/update-scheduler.py",
            "claudeCodeSpecs/maintenance/alert-system.py"
        ]

        for file_path in main_files:
            path = Path(file_path)
            if path.exists():
                print(f"  ✅ {file_path}")
            else:
                print(f"  ❌ Missing: {file_path}")
                return False

        # Check directories are created
        expected_dirs = [
            "claudeCodeSpecs/maintenance",
            "claudeCodeSpecs/maintenance/monitoring_data",
            "claudeCodeSpecs/maintenance/scheduler_data",
            "claudeCodeSpecs/maintenance/alerts"
        ]

        # Create systems to trigger directory creation
        monitor = create_specification_monitor()
        scheduler = create_update_scheduler()
        alert_system = create_alert_system()

        for dir_path in expected_dirs:
            path = Path(dir_path)
            if path.exists() and path.is_dir():
                print(f"  ✅ {dir_path}/")
            else:
                print(f"  ❌ Missing directory: {dir_path}")
                return False

        print("  ✅ File structure validation completed")
        return True

    except Exception as e:
        print(f"  ❌ File structure test failed: {e}")
        return False


async def main():
    """Run all tests for the monitoring and maintenance system."""
    print("🚀 Starting Continuous Monitoring and Maintenance System Tests")
    print("=" * 70)

    # Setup logging
    logging.basicConfig(
        level=logging.WARNING,  # Reduce noise during testing
        format="%(asctime)s - %(levelname)s - %(message)s"
    )

    test_results = []

    # Run all tests
    tests = [
        ("File Structure", test_file_structure),
        ("Monitoring System", test_monitoring_system),
        ("Scheduler System", test_scheduler_system),
        ("Alert System", test_alert_system),
        ("System Integration", test_integration)
    ]

    for test_name, test_func in tests:
        print(f"\n🧪 Running {test_name} Test...")
        try:
            result = await test_func()
            test_results.append((test_name, result))

            if result:
                print(f"✅ {test_name} Test: PASSED")
            else:
                print(f"❌ {test_name} Test: FAILED")

        except Exception as e:
            print(f"❌ {test_name} Test: ERROR - {e}")
            test_results.append((test_name, False))

    # Print summary
    print("\n" + "=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)

    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)

    for test_name, result in test_results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"  {test_name}: {status}")

    print(f"\nOverall Result: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! The monitoring and maintenance system is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Please review the output above.")
        return False


if __name__ == "__main__":
    asyncio.run(main())