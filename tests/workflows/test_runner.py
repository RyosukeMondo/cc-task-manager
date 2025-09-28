#!/usr/bin/env python3
"""
Test runner script for comprehensive workflow testing.

Runs all tests with coverage analysis and generates reports to validate
the 90% test coverage requirement.
"""

import sys
import subprocess
import os
from pathlib import Path
import json
import time


def run_command(cmd, description, capture_output=True):
    """Run a command and return the result."""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {' '.join(cmd)}")
    print(f"{'='*60}")

    start_time = time.time()
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture_output,
            text=True,
            check=False
        )
        end_time = time.time()

        print(f"Duration: {end_time - start_time:.2f}s")
        print(f"Return code: {result.returncode}")

        if result.stdout:
            print(f"STDOUT:\n{result.stdout}")
        if result.stderr:
            print(f"STDERR:\n{result.stderr}")

        return result
    except FileNotFoundError as e:
        print(f"Error: Command not found - {e}")
        return None
    except Exception as e:
        print(f"Error running command: {e}")
        return None


def install_test_dependencies():
    """Install required test dependencies."""
    dependencies = [
        "pytest>=7.0.0",
        "pytest-cov>=4.0.0",
        "pytest-mock>=3.10.0",
        "pytest-xdist>=3.0.0",  # For parallel testing
        "pytest-html>=3.1.0",  # For HTML reports
        "coverage>=7.0.0",
        "psutil>=5.9.0"  # For performance tests
    ]

    print("Installing test dependencies...")
    for dep in dependencies:
        result = run_command(
            [sys.executable, "-m", "pip", "install", dep],
            f"Installing {dep}",
            capture_output=False
        )
        if result and result.returncode != 0:
            print(f"Warning: Failed to install {dep}")

    return True


def run_unit_tests():
    """Run unit tests for core components."""
    test_files = [
        "tests/workflows/core/test_base_workflow.py",
        "tests/workflows/core/test_completion_detector.py",
        "tests/workflows/core/test_workflow_engine.py",
        "tests/workflows/core/test_config_manager.py"
    ]

    cmd = [
        sys.executable, "-m", "pytest",
        "-v",
        "--tb=short",
        "--cov=workflows/core",
        "--cov-report=term-missing",
        "--cov-report=html:htmlcov/unit_tests",
        "--junit-xml=test_results/unit_tests.xml"
    ] + test_files

    return run_command(cmd, "Unit Tests", capture_output=False)


def run_integration_tests():
    """Run integration tests."""
    cmd = [
        sys.executable, "-m", "pytest",
        "-v",
        "--tb=short",
        "tests/workflows/integration/",
        "--cov=workflows/definitions",
        "--cov-append",
        "--cov-report=html:htmlcov/integration_tests",
        "--junit-xml=test_results/integration_tests.xml"
    ]

    return run_command(cmd, "Integration Tests", capture_output=False)


def run_error_handling_tests():
    """Run error handling and edge case tests."""
    cmd = [
        sys.executable, "-m", "pytest",
        "-v",
        "--tb=short",
        "tests/workflows/test_error_handling.py",
        "--cov=workflows",
        "--cov-append",
        "--cov-report=html:htmlcov/error_handling",
        "--junit-xml=test_results/error_handling.xml"
    ]

    return run_command(cmd, "Error Handling Tests", capture_output=False)


def run_performance_tests():
    """Run performance tests."""
    cmd = [
        sys.executable, "-m", "pytest",
        "-v",
        "--tb=short",
        "tests/workflows/performance/",
        "--junit-xml=test_results/performance_tests.xml",
        "-x"  # Stop on first failure for performance tests
    ]

    return run_command(cmd, "Performance Tests", capture_output=False)


def run_all_tests_with_coverage():
    """Run all tests with comprehensive coverage analysis."""
    cmd = [
        sys.executable, "-m", "pytest",
        "-v",
        "--tb=short",
        "tests/workflows/",
        "--cov=workflows",
        "--cov-report=term-missing",
        "--cov-report=html:htmlcov/complete",
        "--cov-report=json:coverage.json",
        "--cov-report=xml:coverage.xml",
        "--junit-xml=test_results/all_tests.xml",
        "--html=test_results/report.html",
        "--self-contained-html"
    ]

    return run_command(cmd, "Complete Test Suite with Coverage", capture_output=False)


def analyze_coverage():
    """Analyze coverage results and check if 90% requirement is met."""
    print(f"\n{'='*60}")
    print("Coverage Analysis")
    print(f"{'='*60}")

    coverage_file = Path("coverage.json")
    if not coverage_file.exists():
        print("Error: coverage.json not found")
        return False

    try:
        with open(coverage_file) as f:
            coverage_data = json.load(f)

        total_coverage = coverage_data.get("totals", {}).get("percent_covered", 0)
        print(f"Total Coverage: {total_coverage:.2f}%")

        # Analyze per-file coverage
        files = coverage_data.get("files", {})
        print(f"\nPer-file Coverage:")
        print(f"{'File':<50} {'Coverage':<10} {'Missing Lines'}")
        print("-" * 80)

        for file_path, file_data in files.items():
            if file_path.startswith("workflows/"):
                coverage_percent = file_data.get("summary", {}).get("percent_covered", 0)
                missing_lines = len(file_data.get("missing_lines", []))
                print(f"{file_path:<50} {coverage_percent:>7.2f}% {missing_lines:>12}")

        # Check requirement
        requirement_met = total_coverage >= 90.0
        print(f"\n90% Coverage Requirement: {'✅ MET' if requirement_met else '❌ NOT MET'}")

        if not requirement_met:
            print(f"Need {90.0 - total_coverage:.2f}% more coverage")

        return requirement_met

    except Exception as e:
        print(f"Error analyzing coverage: {e}")
        return False


def generate_test_summary():
    """Generate a summary of test results."""
    print(f"\n{'='*60}")
    print("Test Summary")
    print(f"{'='*60}")

    # Check for test result files
    result_files = [
        "test_results/unit_tests.xml",
        "test_results/integration_tests.xml",
        "test_results/error_handling.xml",
        "test_results/performance_tests.xml",
        "test_results/all_tests.xml"
    ]

    total_tests = 0
    total_failures = 0
    total_errors = 0

    for result_file in result_files:
        if Path(result_file).exists():
            try:
                # Parse XML to get test counts (simplified)
                with open(result_file) as f:
                    content = f.read()
                    # Basic XML parsing for test counts
                    import re
                    tests_match = re.search(r'tests="(\d+)"', content)
                    failures_match = re.search(r'failures="(\d+)"', content)
                    errors_match = re.search(r'errors="(\d+)"', content)

                    if tests_match:
                        total_tests += int(tests_match.group(1))
                    if failures_match:
                        total_failures += int(failures_match.group(1))
                    if errors_match:
                        total_errors += int(errors_match.group(1))

            except Exception as e:
                print(f"Warning: Could not parse {result_file}: {e}")

    print(f"Total Tests: {total_tests}")
    print(f"Failures: {total_failures}")
    print(f"Errors: {total_errors}")
    print(f"Success Rate: {((total_tests - total_failures - total_errors) / total_tests * 100):.2f}%" if total_tests > 0 else "N/A")

    # Check for HTML report
    html_report = Path("test_results/report.html")
    if html_report.exists():
        print(f"\nHTML Report: {html_report.absolute()}")

    # Check for coverage reports
    coverage_html = Path("htmlcov/complete/index.html")
    if coverage_html.exists():
        print(f"Coverage Report: {coverage_html.absolute()}")

    return total_failures + total_errors == 0


def main():
    """Main test runner function."""
    print("Workflow System Comprehensive Test Runner")
    print("=" * 60)

    # Create directories for results
    os.makedirs("test_results", exist_ok=True)
    os.makedirs("htmlcov", exist_ok=True)

    # Change to project root
    project_root = Path(__file__).parent.parent.parent
    os.chdir(project_root)
    print(f"Working directory: {os.getcwd()}")

    # Install dependencies
    if not install_test_dependencies():
        print("Failed to install test dependencies")
        return 1

    # Track overall success
    all_passed = True

    # Run test suites
    test_suites = [
        ("Unit Tests", run_unit_tests),
        ("Integration Tests", run_integration_tests),
        ("Error Handling Tests", run_error_handling_tests),
        ("Performance Tests", run_performance_tests),
    ]

    for suite_name, suite_func in test_suites:
        print(f"\n{'#'*60}")
        print(f"Running {suite_name}")
        print(f"{'#'*60}")

        result = suite_func()
        if result is None or result.returncode != 0:
            print(f"❌ {suite_name} FAILED")
            all_passed = False
        else:
            print(f"✅ {suite_name} PASSED")

    # Run complete test suite with coverage
    print(f"\n{'#'*60}")
    print("Running Complete Test Suite")
    print(f"{'#'*60}")

    complete_result = run_all_tests_with_coverage()
    if complete_result is None or complete_result.returncode != 0:
        print("❌ Complete Test Suite FAILED")
        all_passed = False
    else:
        print("✅ Complete Test Suite PASSED")

    # Analyze coverage
    coverage_met = analyze_coverage()
    if not coverage_met:
        print("❌ Coverage requirement NOT MET")
        all_passed = False
    else:
        print("✅ Coverage requirement MET")

    # Generate summary
    summary_success = generate_test_summary()
    if not summary_success:
        all_passed = False

    # Final result
    print(f"\n{'='*60}")
    if all_passed:
        print("🎉 ALL TESTS PASSED - Task 10 Complete!")
        print("✅ Comprehensive test suite implemented")
        print("✅ 90% coverage requirement met")
        print("✅ All workflow types tested")
        print("✅ Error handling validated")
        print("✅ Performance benchmarks established")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        print("Please review the output above for details")
        return 1


if __name__ == "__main__":
    sys.exit(main())