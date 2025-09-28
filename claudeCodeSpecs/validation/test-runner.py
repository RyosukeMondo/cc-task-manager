#!/usr/bin/env python3
"""
Test Runner for Claude Code Wrapper Specification Validation

This module provides automated test execution and reporting for Claude Code
wrapper validation. It orchestrates schema validation, compliance checking,
and regression testing workflows with CI/CD integration support.

Requirements satisfied: 5.2, 5.3, 5.4 - Automated validation workflows
"""

import json
import os
import sys
import time
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
import concurrent.futures
import argparse

from schema_validator import SchemaValidator, SchemaType, ValidationResult
from compliance_checker import ComplianceChecker, ComplianceLevel, ComplianceReport, ComplianceStatus


class TestSuite(Enum):
    """Available test suites for validation"""
    SCHEMA_ONLY = "schema"
    COMPLIANCE_ONLY = "compliance"
    FULL_VALIDATION = "full"
    REGRESSION = "regression"


class TestResult(Enum):
    """Test execution results"""
    PASS = "pass"
    FAIL = "fail"
    ERROR = "error"
    SKIP = "skip"


@dataclass
class TestCase:
    """Individual test case definition"""
    name: str
    description: str
    test_type: str
    data_file: Optional[str] = None
    expected_result: bool = True
    timeout: int = 30
    skip_reason: Optional[str] = None


@dataclass
class TestSuiteResult:
    """Results from a complete test suite execution"""
    suite_name: str
    start_time: str
    end_time: str
    duration_seconds: float
    total_tests: int
    passed_tests: int
    failed_tests: int
    error_tests: int
    skipped_tests: int
    test_results: List[Dict[str, Any]] = field(default_factory=list)
    overall_result: TestResult = TestResult.PASS
    summary_report: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert test suite result to dictionary"""
        return {
            "suite_name": self.suite_name,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_seconds": self.duration_seconds,
            "total_tests": self.total_tests,
            "passed_tests": self.passed_tests,
            "failed_tests": self.failed_tests,
            "error_tests": self.error_tests,
            "skipped_tests": self.skipped_tests,
            "overall_result": self.overall_result.value,
            "test_results": self.test_results,
            "summary_report": self.summary_report
        }


class TestRunner:
    """
    Automated test runner for Claude Code wrapper specification validation.

    Orchestrates different types of validation tests and generates comprehensive
    reports for CI/CD integration and development feedback.
    """

    def __init__(self, config_file: Optional[str] = None):
        """
        Initialize test runner with optional configuration.

        Args:
            config_file: Path to test configuration file
        """
        self.config = self._load_config(config_file)
        self.schema_validator = SchemaValidator()
        self.compliance_checker = ComplianceChecker()
        self.test_cases: List[TestCase] = []
        self.results_dir = Path(self.config.get("results_dir", "claudeCodeSpecs/validation/results"))
        self.results_dir.mkdir(parents=True, exist_ok=True)

    def _load_config(self, config_file: Optional[str]) -> Dict[str, Any]:
        """Load test configuration from file or use defaults"""
        default_config = {
            "timeout": 30,
            "parallel_execution": True,
            "max_workers": 4,
            "results_dir": "claudeCodeSpecs/validation/results",
            "test_data_dir": "claudeCodeSpecs/validation/test-data",
            "generate_html_report": True,
            "ci_integration": {
                "junit_xml": True,
                "github_actions": True
            }
        }

        if config_file and os.path.exists(config_file):
            try:
                with open(config_file, 'r') as f:
                    user_config = json.load(f)
                default_config.update(user_config)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Failed to load config file {config_file}: {e}")

        return default_config

    def add_schema_tests(self, test_data_dir: Optional[str] = None) -> None:
        """
        Add schema validation test cases from test data directory.

        Args:
            test_data_dir: Directory containing test JSON files
        """
        if test_data_dir is None:
            test_data_dir = self.config.get("test_data_dir", "claudeCodeSpecs/validation/test-data")

        test_data_path = Path(test_data_dir)
        if not test_data_path.exists():
            print(f"Warning: Test data directory {test_data_path} not found")
            return

        # Add schema validation tests for each schema type
        schema_types = {
            "commands": SchemaType.COMMANDS,
            "events": SchemaType.EVENTS,
            "states": SchemaType.STATES
        }

        for schema_name, schema_type in schema_types.items():
            # Add positive test cases (valid data)
            valid_dir = test_data_path / schema_name / "valid"
            if valid_dir.exists():
                for test_file in valid_dir.glob("*.json"):
                    self.test_cases.append(TestCase(
                        name=f"schema_{schema_name}_valid_{test_file.stem}",
                        description=f"Validate {test_file.name} against {schema_name} schema (should pass)",
                        test_type="schema_validation",
                        data_file=str(test_file),
                        expected_result=True
                    ))

            # Add negative test cases (invalid data)
            invalid_dir = test_data_path / schema_name / "invalid"
            if invalid_dir.exists():
                for test_file in invalid_dir.glob("*.json"):
                    self.test_cases.append(TestCase(
                        name=f"schema_{schema_name}_invalid_{test_file.stem}",
                        description=f"Validate {test_file.name} against {schema_name} schema (should fail)",
                        test_type="schema_validation",
                        data_file=str(test_file),
                        expected_result=False
                    ))

    def add_compliance_tests(self, wrapper_configs: List[Dict[str, Any]]) -> None:
        """
        Add compliance test cases for wrapper implementations.

        Args:
            wrapper_configs: List of wrapper configuration dictionaries
        """
        for config in wrapper_configs:
            wrapper_path = config.get("path")
            wrapper_name = config.get("name", Path(wrapper_path).name)
            level = ComplianceLevel(config.get("level", "standard"))
            working_dir = config.get("working_dir")

            if not wrapper_path or not os.path.exists(wrapper_path):
                continue

            self.test_cases.append(TestCase(
                name=f"compliance_{wrapper_name}_{level.value}",
                description=f"Compliance validation for {wrapper_name} at {level.value} level",
                test_type="compliance_check",
                data_file=json.dumps({
                    "wrapper_path": wrapper_path,
                    "level": level.value,
                    "working_dir": working_dir
                }),
                timeout=config.get("timeout", 60)
            ))

    def add_regression_tests(self, baseline_dir: Optional[str] = None) -> None:
        """
        Add regression test cases based on historical baselines.

        Args:
            baseline_dir: Directory containing baseline test results
        """
        if baseline_dir is None:
            baseline_dir = str(self.results_dir / "baselines")

        baseline_path = Path(baseline_dir)
        if not baseline_path.exists():
            print(f"Warning: Baseline directory {baseline_path} not found")
            return

        # Add regression tests based on previous compliance reports
        for baseline_file in baseline_path.glob("compliance_*.json"):
            try:
                with open(baseline_file, 'r') as f:
                    baseline_data = json.load(f)

                wrapper_name = baseline_data.get("wrapper_name", baseline_file.stem)

                self.test_cases.append(TestCase(
                    name=f"regression_{wrapper_name}",
                    description=f"Regression test for {wrapper_name} against baseline",
                    test_type="regression_check",
                    data_file=str(baseline_file),
                    timeout=90
                ))

            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Failed to load baseline {baseline_file}: {e}")

    def run_test_suite(self, suite_type: TestSuite,
                      wrapper_configs: Optional[List[Dict[str, Any]]] = None) -> TestSuiteResult:
        """
        Execute a complete test suite.

        Args:
            suite_type: Type of test suite to run
            wrapper_configs: Wrapper configurations for compliance testing

        Returns:
            TestSuiteResult with comprehensive execution results
        """
        start_time = time.time()
        start_time_str = time.strftime("%Y-%m-%d %H:%M:%S")

        # Clear previous test cases
        self.test_cases = []

        # Add appropriate test cases based on suite type
        if suite_type in [TestSuite.SCHEMA_ONLY, TestSuite.FULL_VALIDATION]:
            self.add_schema_tests()

        if suite_type in [TestSuite.COMPLIANCE_ONLY, TestSuite.FULL_VALIDATION]:
            if wrapper_configs:
                self.add_compliance_tests(wrapper_configs)

        if suite_type == TestSuite.REGRESSION:
            self.add_regression_tests()

        # Execute test cases
        if self.config.get("parallel_execution", True) and len(self.test_cases) > 1:
            test_results = self._run_tests_parallel()
        else:
            test_results = self._run_tests_sequential()

        # Calculate results
        end_time = time.time()
        end_time_str = time.strftime("%Y-%m-%d %H:%M:%S")
        duration = end_time - start_time

        # Count results by type
        passed = sum(1 for r in test_results if r["result"] == TestResult.PASS.value)
        failed = sum(1 for r in test_results if r["result"] == TestResult.FAIL.value)
        errors = sum(1 for r in test_results if r["result"] == TestResult.ERROR.value)
        skipped = sum(1 for r in test_results if r["result"] == TestResult.SKIP.value)

        # Determine overall result
        if errors > 0:
            overall_result = TestResult.ERROR
        elif failed > 0:
            overall_result = TestResult.FAIL
        else:
            overall_result = TestResult.PASS

        # Create suite result
        suite_result = TestSuiteResult(
            suite_name=suite_type.value,
            start_time=start_time_str,
            end_time=end_time_str,
            duration_seconds=duration,
            total_tests=len(test_results),
            passed_tests=passed,
            failed_tests=failed,
            error_tests=errors,
            skipped_tests=skipped,
            test_results=test_results,
            overall_result=overall_result
        )

        # Generate summary report
        self._generate_summary_report(suite_result)

        # Save results
        self._save_results(suite_result)

        return suite_result

    def _run_tests_sequential(self) -> List[Dict[str, Any]]:
        """Execute test cases sequentially"""
        results = []
        for i, test_case in enumerate(self.test_cases):
            print(f"Running test {i+1}/{len(self.test_cases)}: {test_case.name}")
            result = self._execute_test_case(test_case)
            results.append(result)
        return results

    def _run_tests_parallel(self) -> List[Dict[str, Any]]:
        """Execute test cases in parallel"""
        results = []
        max_workers = self.config.get("max_workers", 4)

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all test cases
            future_to_test = {
                executor.submit(self._execute_test_case, test_case): test_case
                for test_case in self.test_cases
            }

            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_test):
                test_case = future_to_test[future]
                try:
                    result = future.result()
                    results.append(result)
                    print(f"Completed: {test_case.name}")
                except Exception as e:
                    error_result = {
                        "test_name": test_case.name,
                        "test_type": test_case.test_type,
                        "result": TestResult.ERROR.value,
                        "error_message": f"Test execution failed: {e}",
                        "duration": 0.0
                    }
                    results.append(error_result)

        return results

    def _execute_test_case(self, test_case: TestCase) -> Dict[str, Any]:
        """
        Execute individual test case.

        Args:
            test_case: Test case to execute

        Returns:
            Dictionary with test execution results
        """
        start_time = time.time()

        # Check for skip conditions
        if test_case.skip_reason:
            return {
                "test_name": test_case.name,
                "test_type": test_case.test_type,
                "result": TestResult.SKIP.value,
                "skip_reason": test_case.skip_reason,
                "duration": 0.0
            }

        try:
            if test_case.test_type == "schema_validation":
                result = self._execute_schema_test(test_case)
            elif test_case.test_type == "compliance_check":
                result = self._execute_compliance_test(test_case)
            elif test_case.test_type == "regression_check":
                result = self._execute_regression_test(test_case)
            else:
                result = {
                    "result": TestResult.ERROR.value,
                    "error_message": f"Unknown test type: {test_case.test_type}"
                }

        except Exception as e:
            result = {
                "result": TestResult.ERROR.value,
                "error_message": f"Test execution failed: {e}"
            }

        # Add common fields
        result.update({
            "test_name": test_case.name,
            "test_type": test_case.test_type,
            "duration": time.time() - start_time
        })

        return result

    def _execute_schema_test(self, test_case: TestCase) -> Dict[str, Any]:
        """Execute schema validation test case"""
        if not test_case.data_file or not os.path.exists(test_case.data_file):
            return {
                "result": TestResult.ERROR.value,
                "error_message": f"Test data file not found: {test_case.data_file}"
            }

        # Determine schema type from file path
        data_path = Path(test_case.data_file)
        if "commands" in str(data_path):
            schema_type = SchemaType.COMMANDS
        elif "events" in str(data_path):
            schema_type = SchemaType.EVENTS
        elif "states" in str(data_path):
            schema_type = SchemaType.STATES
        else:
            return {
                "result": TestResult.ERROR.value,
                "error_message": "Could not determine schema type from file path"
            }

        # Load test data
        try:
            with open(test_case.data_file, 'r') as f:
                test_data = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            return {
                "result": TestResult.ERROR.value,
                "error_message": f"Failed to load test data: {e}"
            }

        # Perform validation
        validation_result = self.schema_validator._validate_data(test_data, schema_type)

        # Check if result matches expectation
        validation_passed = validation_result.is_valid
        expectation_met = validation_passed == test_case.expected_result

        if expectation_met:
            return {
                "result": TestResult.PASS.value,
                "validation_details": {
                    "is_valid": validation_passed,
                    "errors": validation_result.errors,
                    "warnings": validation_result.warnings
                }
            }
        else:
            return {
                "result": TestResult.FAIL.value,
                "error_message": f"Expected validation to {'pass' if test_case.expected_result else 'fail'}, but got {'pass' if validation_passed else 'fail'}",
                "validation_details": {
                    "is_valid": validation_passed,
                    "errors": validation_result.errors,
                    "warnings": validation_result.warnings
                }
            }

    def _execute_compliance_test(self, test_case: TestCase) -> Dict[str, Any]:
        """Execute compliance validation test case"""
        try:
            config = json.loads(test_case.data_file)
            wrapper_path = config["wrapper_path"]
            level = ComplianceLevel(config["level"])
            working_dir = config.get("working_dir")
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            return {
                "result": TestResult.ERROR.value,
                "error_message": f"Invalid compliance test configuration: {e}"
            }

        # Run compliance check
        compliance_report = self.compliance_checker.validate_wrapper(
            wrapper_path, level, working_dir
        )

        # Determine test result based on compliance status
        if compliance_report.overall_status == ComplianceStatus.PASS:
            result_status = TestResult.PASS
        elif compliance_report.overall_status == ComplianceStatus.WARNING:
            result_status = TestResult.PASS  # Warnings still count as pass
        else:
            result_status = TestResult.FAIL

        return {
            "result": result_status.value,
            "compliance_report": compliance_report.to_dict()
        }

    def _execute_regression_test(self, test_case: TestCase) -> Dict[str, Any]:
        """Execute regression test case"""
        # This would implement regression testing logic
        # For now, return skip status
        return {
            "result": TestResult.SKIP.value,
            "skip_reason": "Regression testing not yet implemented"
        }

    def _generate_summary_report(self, suite_result: TestSuiteResult) -> None:
        """Generate summary report for test suite results"""
        suite_result.summary_report = {
            "success_rate": (suite_result.passed_tests / suite_result.total_tests * 100) if suite_result.total_tests > 0 else 0,
            "test_categories": self._categorize_test_results(suite_result.test_results),
            "performance_metrics": {
                "total_duration": suite_result.duration_seconds,
                "average_test_duration": suite_result.duration_seconds / suite_result.total_tests if suite_result.total_tests > 0 else 0,
                "tests_per_second": suite_result.total_tests / suite_result.duration_seconds if suite_result.duration_seconds > 0 else 0
            }
        }

    def _categorize_test_results(self, test_results: List[Dict[str, Any]]) -> Dict[str, Dict[str, int]]:
        """Categorize test results by type and status"""
        categories = {}
        for result in test_results:
            test_type = result.get("test_type", "unknown")
            status = result.get("result", "unknown")

            if test_type not in categories:
                categories[test_type] = {"pass": 0, "fail": 0, "error": 0, "skip": 0}

            if status in categories[test_type]:
                categories[test_type][status] += 1

        return categories

    def _save_results(self, suite_result: TestSuiteResult) -> None:
        """Save test results to files"""
        timestamp = time.strftime("%Y%m%d_%H%M%S")

        # Save JSON results
        json_file = self.results_dir / f"{suite_result.suite_name}_{timestamp}.json"
        with open(json_file, 'w') as f:
            json.dump(suite_result.to_dict(), f, indent=2)

        print(f"Results saved to: {json_file}")

        # Generate additional formats if configured
        if self.config.get("ci_integration", {}).get("junit_xml", False):
            self._generate_junit_xml(suite_result, timestamp)

        if self.config.get("generate_html_report", False):
            self._generate_html_report(suite_result, timestamp)

    def _generate_junit_xml(self, suite_result: TestSuiteResult, timestamp: str) -> None:
        """Generate JUnit XML format for CI integration"""
        # This would generate JUnit XML output
        xml_file = self.results_dir / f"{suite_result.suite_name}_{timestamp}.xml"
        print(f"JUnit XML generation not yet implemented, would save to: {xml_file}")

    def _generate_html_report(self, suite_result: TestSuiteResult, timestamp: str) -> None:
        """Generate HTML report for human review"""
        # This would generate HTML report
        html_file = self.results_dir / f"{suite_result.suite_name}_{timestamp}.html"
        print(f"HTML report generation not yet implemented, would save to: {html_file}")


def main():
    """CLI interface for test runner"""
    parser = argparse.ArgumentParser(description="Claude Code Wrapper Specification Test Runner")
    parser.add_argument("suite", choices=["schema", "compliance", "full", "regression"],
                       help="Test suite to run")
    parser.add_argument("--config", help="Path to test configuration file")
    parser.add_argument("--wrappers", help="Path to wrapper configurations JSON file")
    parser.add_argument("--output-dir", help="Directory for test results")

    args = parser.parse_args()

    # Load wrapper configurations if provided
    wrapper_configs = []
    if args.wrappers and os.path.exists(args.wrappers):
        try:
            with open(args.wrappers, 'r') as f:
                wrapper_configs = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Failed to load wrapper configs: {e}")
            sys.exit(1)

    # Initialize test runner
    runner = TestRunner(args.config)
    if args.output_dir:
        runner.results_dir = Path(args.output_dir)
        runner.results_dir.mkdir(parents=True, exist_ok=True)

    # Run test suite
    suite_type = TestSuite(args.suite)
    result = runner.run_test_suite(suite_type, wrapper_configs)

    # Print summary
    print(f"\nTest Suite: {result.suite_name}")
    print(f"Duration: {result.duration_seconds:.2f} seconds")
    print(f"Total Tests: {result.total_tests}")
    print(f"Passed: {result.passed_tests}")
    print(f"Failed: {result.failed_tests}")
    print(f"Errors: {result.error_tests}")
    print(f"Skipped: {result.skipped_tests}")
    print(f"Overall Result: {result.overall_result.value}")

    # Exit with appropriate code
    if result.overall_result == TestResult.PASS:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()