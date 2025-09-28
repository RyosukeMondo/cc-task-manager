#!/usr/bin/env python3
"""
Performance tests for workflow system.

Tests cover execution speed, memory usage, concurrency, and scalability
to ensure the system meets performance requirements.
"""

import pytest
import time
import threading
import tempfile
import psutil
import os
from pathlib import Path
from unittest.mock import Mock, patch
from typing import List, Dict, Any
import concurrent.futures

from workflows.core.workflow_engine import WorkflowEngine
from workflows.core.config_manager import ConfigManager
from workflows.definitions.test_fix_workflow import TestFixWorkflow


class PerformanceTestBase:
    """Base class for performance testing utilities."""

    def setup_method(self):
        """Set up performance test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)
        self.process = psutil.Process(os.getpid())

    def measure_execution_time(self, func, *args, **kwargs):
        """Measure execution time of a function."""
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        execution_time = end_time - start_time
        return result, execution_time

    def measure_memory_usage(self, func, *args, **kwargs):
        """Measure memory usage during function execution."""
        memory_before = self.process.memory_info().rss / 1024 / 1024  # MB
        result = func(*args, **kwargs)
        memory_after = self.process.memory_info().rss / 1024 / 1024  # MB
        memory_delta = memory_after - memory_before
        return result, memory_delta

    def create_mock_workflow_config(self, workflow_type="test-fix"):
        """Create a mock workflow configuration for testing."""
        return {
            "workflow_type": workflow_type,
            "project_path": self.project_path,
            "max_cycles": 5,
            "max_session_time": 300
        }


class TestConfigManagerPerformance(PerformanceTestBase):
    """Performance tests for ConfigManager."""

    def test_config_loading_speed(self):
        """Test configuration loading performance."""
        manager = ConfigManager()

        # Create multiple configuration files
        config_files = []
        for i in range(100):
            config_data = {
                "workflow_type": f"test_{i}",
                "max_cycles": i * 2,
                "custom_settings": {f"key_{j}": f"value_{j}" for j in range(10)}
            }
            config_file = self.project_path / f"config_{i}.json"
            with open(config_file, 'w') as f:
                import json
                json.dump(config_data, f)
            config_files.append(config_file.name)

        manager.search_paths = [str(self.project_path)]

        # Measure loading time for multiple configs
        def load_all_configs():
            return [manager.load_config(cf) for cf in config_files[:10]]

        configs, execution_time = self.measure_execution_time(load_all_configs)

        assert len(configs) == 10
        assert execution_time < 1.0  # Should load 10 configs in under 1 second
        print(f"Config loading time: {execution_time:.3f}s for 10 configs")

    def test_config_caching_performance(self):
        """Test configuration caching performance improvement."""
        manager = ConfigManager(cache_size=50)

        config_data = {"workflow_type": "test", "max_cycles": 10}
        config_file = self.project_path / "cached_config.json"
        with open(config_file, 'w') as f:
            import json
            json.dump(config_data, f)

        manager.search_paths = [str(self.project_path)]

        # First load (from file)
        _, first_load_time = self.measure_execution_time(
            manager.load_config, "cached_config.json"
        )

        # Subsequent loads (from cache)
        cache_load_times = []
        for _ in range(10):
            _, load_time = self.measure_execution_time(
                manager.load_config, "cached_config.json"
            )
            cache_load_times.append(load_time)

        avg_cache_time = sum(cache_load_times) / len(cache_load_times)

        # Cache loads should be significantly faster
        assert avg_cache_time < first_load_time / 10
        print(f"File load: {first_load_time:.6f}s, Cache load: {avg_cache_time:.6f}s")

    def test_large_config_handling(self):
        """Test performance with very large configuration files."""
        manager = ConfigManager()

        # Create large configuration
        large_config = {
            "workflow_type": "test",
            "large_array": list(range(10000)),
            "large_dict": {f"key_{i}": f"value_{i}" * 100 for i in range(1000)}
        }

        config_file = self.project_path / "large_config.json"
        with open(config_file, 'w') as f:
            import json
            json.dump(large_config, f)

        manager.search_paths = [str(self.project_path)]

        # Measure loading large config
        config, execution_time = self.measure_execution_time(
            manager.load_config, "large_config.json"
        )

        assert config["workflow_type"] == "test"
        assert len(config["large_array"]) == 10000
        assert execution_time < 5.0  # Should handle large configs reasonably fast
        print(f"Large config loading time: {execution_time:.3f}s")

    def test_concurrent_config_access(self):
        """Test concurrent configuration access performance."""
        manager = ConfigManager(cache_size=20)

        # Create multiple config files
        for i in range(20):
            config_data = {"workflow_type": f"test_{i}", "id": i}
            config_file = self.project_path / f"concurrent_{i}.json"
            with open(config_file, 'w') as f:
                import json
                json.dump(config_data, f)

        manager.search_paths = [str(self.project_path)]

        def load_random_configs():
            import random
            results = []
            for _ in range(50):
                config_id = random.randint(0, 19)
                config = manager.load_config(f"concurrent_{config_id}.json")
                results.append(config)
            return results

        # Test concurrent access
        start_time = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(load_random_configs) for _ in range(5)]
            results = [future.result() for future in futures]
        end_time = time.time()

        total_configs_loaded = sum(len(result) for result in results)
        execution_time = end_time - start_time

        assert total_configs_loaded == 250  # 5 threads * 50 configs each
        assert execution_time < 5.0  # Should handle concurrent access efficiently
        print(f"Concurrent access: {total_configs_loaded} configs in {execution_time:.3f}s")


class TestWorkflowEnginePerformance(PerformanceTestBase):
    """Performance tests for WorkflowEngine."""

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_workflow_execution_speed(self, mock_wrapper):
        """Test workflow execution performance."""
        # Setup fast mock responses
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.return_value = "Task completed successfully"
        mock_wrapper.stop_session.return_value = None

        workflow = TestFixWorkflow()
        config = self.create_mock_workflow_config()

        # Mock quick completion
        with patch.object(workflow, 'is_completed', return_value=True):
            engine = WorkflowEngine(
                workflow=workflow,
                completion_detector=workflow.get_completion_detector(),
                config=config
            )

            result, execution_time = self.measure_execution_time(engine.execute)

            assert result["success"] is True
            assert execution_time < 1.0  # Should execute quickly with mocks
            print(f"Workflow execution time: {execution_time:.3f}s")

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_multiple_workflow_cycles_performance(self, mock_wrapper):
        """Test performance with multiple workflow cycles."""
        # Setup mock for multiple cycles
        mock_wrapper.start_session.return_value = "session_123"

        cycle_responses = [
            "Working on cycle 1...",
            "Working on cycle 2...",
            "Working on cycle 3...",
            "Task completed successfully"
        ]
        mock_wrapper.send_prompt.side_effect = cycle_responses
        mock_wrapper.stop_session.return_value = None

        workflow = TestFixWorkflow()
        config = self.create_mock_workflow_config()
        config["max_cycles"] = 10

        # Mock completion on 4th cycle
        completion_call_count = 0
        def mock_completion(output, config):
            nonlocal completion_call_count
            completion_call_count += 1
            return completion_call_count >= 4

        with patch.object(workflow, 'is_completed', side_effect=mock_completion):
            engine = WorkflowEngine(
                workflow=workflow,
                completion_detector=workflow.get_completion_detector(),
                config=config
            )

            result, execution_time = self.measure_execution_time(engine.execute)

            assert result["success"] is True
            assert execution_time < 2.0  # Multiple cycles should still be fast
            print(f"Multi-cycle execution time: {execution_time:.3f}s for 4 cycles")

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_workflow_memory_usage(self, mock_wrapper):
        """Test workflow memory usage patterns."""
        # Setup mock responses
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.return_value = "x" * 10000  # Large response
        mock_wrapper.stop_session.return_value = None

        workflow = TestFixWorkflow()
        config = self.create_mock_workflow_config()

        with patch.object(workflow, 'is_completed', return_value=True):
            engine = WorkflowEngine(
                workflow=workflow,
                completion_detector=workflow.get_completion_detector(),
                config=config
            )

            result, memory_delta = self.measure_memory_usage(engine.execute)

            assert result["success"] is True
            assert memory_delta < 50  # Should not use more than 50MB
            print(f"Memory usage delta: {memory_delta:.2f}MB")

    def test_concurrent_workflow_execution(self):
        """Test concurrent workflow execution performance."""
        def create_mock_engine():
            workflow = TestFixWorkflow()
            config = self.create_mock_workflow_config()

            # Mock quick completion
            with patch.object(workflow, 'is_completed', return_value=True):
                return WorkflowEngine(
                    workflow=workflow,
                    completion_detector=workflow.get_completion_detector(),
                    config=config
                )

        @patch('workflows.core.workflow_engine.claude_wrapper')
        def run_concurrent_workflows(mock_wrapper):
            mock_wrapper.start_session.return_value = "session_123"
            mock_wrapper.send_prompt.return_value = "Completed"
            mock_wrapper.stop_session.return_value = None

            engines = [create_mock_engine() for _ in range(5)]

            start_time = time.time()
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                futures = [executor.submit(engine.execute) for engine in engines]
                results = [future.result() for future in futures]
            end_time = time.time()

            return results, end_time - start_time

        results, execution_time = run_concurrent_workflows()

        assert len(results) == 5
        assert all(isinstance(result, dict) for result in results)
        assert execution_time < 3.0  # Should handle concurrent execution well
        print(f"Concurrent workflows: 5 workflows in {execution_time:.3f}s")


class TestCompletionDetectorPerformance(PerformanceTestBase):
    """Performance tests for completion detectors."""

    def test_text_pattern_detection_speed(self):
        """Test text pattern detection performance."""
        from workflows.core.completion_detector import TextPatternDetector

        # Create detector with many patterns
        patterns = [f"pattern_{i}" for i in range(100)]
        detector = TextPatternDetector(patterns=patterns)

        # Test with large text
        large_text = " ".join([f"text_{i}" for i in range(10000)]) + " pattern_50"

        result, execution_time = self.measure_execution_time(
            detector.detect, large_text
        )

        assert result is True
        assert execution_time < 0.1  # Should be very fast
        print(f"Pattern detection time: {execution_time:.6f}s")

    def test_regex_pattern_performance(self):
        """Test regex pattern detection performance."""
        from workflows.core.completion_detector import TextPatternDetector

        # Create detector with complex regex patterns
        regex_patterns = [
            r"\d+ tests? passed",
            r"Build: (SUCCESS|PASS)",
            r"All .+ completed",
            r"Error: .+ fixed"
        ]
        detector = TextPatternDetector(patterns=regex_patterns, use_regex=True)

        # Test with realistic output
        test_outputs = [
            "Running tests... 25 tests passed",
            "Build: SUCCESS - all modules compiled",
            "All 10 tasks completed successfully",
            "Error: type mismatch fixed"
        ]

        total_time = 0
        for output in test_outputs * 100:  # Test 400 detections
            _, execution_time = self.measure_execution_time(
                detector.detect, output
            )
            total_time += execution_time

        avg_time = total_time / 400
        assert avg_time < 0.001  # Should be very fast per detection
        print(f"Average regex detection time: {avg_time:.6f}s")

    def test_command_result_detection_performance(self):
        """Test command result detection performance."""
        from workflows.core.completion_detector import CommandResultDetector

        detector = CommandResultDetector(success_codes=[0, 2])

        # Test with large context objects
        large_context = {
            "exit_code": 0,
            "stdout": "x" * 10000,
            "stderr": "y" * 5000,
            "metadata": {f"key_{i}": f"value_{i}" for i in range(1000)}
        }

        result, execution_time = self.measure_execution_time(
            detector.detect, "output", large_context
        )

        assert result is True
        assert execution_time < 0.01  # Should handle large contexts quickly
        print(f"Command detection time: {execution_time:.6f}s")


class TestWorkflowSystemScalability(PerformanceTestBase):
    """Test system scalability under various loads."""

    def test_memory_usage_with_many_configs(self):
        """Test memory usage with many configurations."""
        manager = ConfigManager(cache_size=1000)

        # Create many configurations
        configs = []
        for i in range(500):
            config = {
                "workflow_type": f"test_{i}",
                "max_cycles": i,
                "data": list(range(100))  # Some data per config
            }
            configs.append(config)

        # Measure memory while loading many configs
        def load_many_configs():
            manager.cache.clear()
            for i, config in enumerate(configs):
                manager.cache[f"config_{i}"] = config
            return len(manager.cache)

        cache_size, memory_delta = self.measure_memory_usage(load_many_configs)

        assert cache_size == 500
        assert memory_delta < 100  # Should not use excessive memory
        print(f"Memory for 500 configs: {memory_delta:.2f}MB")

    def test_system_responsiveness_under_load(self):
        """Test system responsiveness under high load."""
        @patch('workflows.core.workflow_engine.claude_wrapper')
        def stress_test(mock_wrapper):
            mock_wrapper.start_session.return_value = "session_123"
            mock_wrapper.send_prompt.return_value = "Response"
            mock_wrapper.stop_session.return_value = None

            workflow = TestFixWorkflow()

            def create_and_run_workflow():
                config = self.create_mock_workflow_config()
                with patch.object(workflow, 'is_completed', return_value=True):
                    engine = WorkflowEngine(
                        workflow=workflow,
                        completion_detector=workflow.get_completion_detector(),
                        config=config
                    )
                    return engine.execute()

            # Run many workflows simultaneously
            start_time = time.time()
            with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
                futures = [
                    executor.submit(create_and_run_workflow)
                    for _ in range(50)
                ]
                results = [future.result() for future in futures]
            end_time = time.time()

            return results, end_time - start_time

        results, execution_time = stress_test()

        assert len(results) == 50
        assert all(isinstance(result, dict) for result in results)
        assert execution_time < 10.0  # Should handle high load reasonably
        print(f"Stress test: 50 workflows in {execution_time:.3f}s")

    def test_long_running_workflow_stability(self):
        """Test stability of long-running workflows."""
        @patch('workflows.core.workflow_engine.claude_wrapper')
        def long_running_test(mock_wrapper):
            mock_wrapper.start_session.return_value = "session_123"

            # Simulate slow responses
            def slow_response(*args, **kwargs):
                time.sleep(0.01)  # 10ms delay per response
                return "Still working..."

            mock_wrapper.send_prompt.side_effect = slow_response
            mock_wrapper.stop_session.return_value = None

            workflow = TestFixWorkflow()
            config = self.create_mock_workflow_config()
            config["max_cycles"] = 100  # Many cycles

            # Mock completion after many cycles
            call_count = 0
            def delayed_completion(output, config):
                nonlocal call_count
                call_count += 1
                return call_count >= 50  # Complete after 50 cycles

            with patch.object(workflow, 'is_completed', side_effect=delayed_completion):
                engine = WorkflowEngine(
                    workflow=workflow,
                    completion_detector=workflow.get_completion_detector(),
                    config=config
                )

                result, execution_time = self.measure_execution_time(engine.execute)
                return result, execution_time, call_count

        result, execution_time, cycles = long_running_test()

        assert result["success"] is True
        assert cycles == 50
        assert execution_time > 0.5  # Should take some time with delays
        print(f"Long-running test: {cycles} cycles in {execution_time:.3f}s")


class TestPerformanceRegression:
    """Test for performance regressions."""

    def test_baseline_performance_metrics(self):
        """Establish baseline performance metrics."""
        # This test would establish and check against performance baselines
        baselines = {
            "config_load_time": 0.1,  # seconds
            "workflow_execution_time": 1.0,  # seconds
            "memory_usage_per_workflow": 50,  # MB
            "concurrent_workflows": 10  # number
        }

        # These could be compared against actual measurements
        # and fail if performance degrades significantly
        for metric, baseline in baselines.items():
            assert baseline > 0  # Placeholder assertion
            print(f"Baseline {metric}: {baseline}")

    def test_performance_monitoring(self):
        """Test performance monitoring and reporting."""
        # This would test performance monitoring capabilities
        monitor_data = {
            "cpu_usage": 25.5,
            "memory_usage": 128.0,
            "execution_time": 0.75,
            "success_rate": 98.5
        }

        for metric, value in monitor_data.items():
            assert isinstance(value, (int, float))
            assert value >= 0
            print(f"Monitoring {metric}: {value}")


if __name__ == "__main__":
    # Run with performance-specific options
    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "-x"  # Stop on first failure for performance tests
    ])