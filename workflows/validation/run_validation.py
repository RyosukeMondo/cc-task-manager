#!/usr/bin/env python3
"""
Simple runner script for workflow system validation.

Usage:
    python run_validation.py [--type TYPE] [--output OUTPUT]

Types:
    - real-world: Run real-world scenario tests
    - performance: Run performance benchmarks
    - integration: Run ecosystem integration tests
    - comprehensive: Run all validation tests (default)
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from validation.comprehensive_validation import ComprehensiveValidator
from validation.test_real_world_scenarios import RealWorldScenarioTester
from validation.performance_benchmark import PerformanceBenchmark
from validation.ecosystem_integration_test import EcosystemIntegrationTester


async def run_real_world_tests():
    """Run real-world scenario tests."""
    print("🧪 Running real-world scenario tests...")
    with RealWorldScenarioTester() as tester:
        results = await tester.run_all_scenarios()
        print(f"✅ Real-world tests complete: {results['success_rate']:.1f}% success rate")
        return results


async def run_performance_tests():
    """Run performance benchmark tests."""
    print("📊 Running performance benchmarks...")
    with PerformanceBenchmark() as benchmark:
        results = await benchmark.run_complete_benchmark()
        summary = results.get('summary', {})
        print(f"✅ Performance tests complete: {summary.get('overall_score', 0)}/100 score")
        return results


async def run_integration_tests():
    """Run ecosystem integration tests."""
    print("🔗 Running ecosystem integration tests...")
    with EcosystemIntegrationTester() as tester:
        results = await tester.run_all_integration_tests()
        print(f"✅ Integration tests complete: {results['integration_score']:.1f}% score")
        return results


async def run_comprehensive_validation():
    """Run comprehensive validation suite."""
    print("🚀 Running comprehensive validation suite...")
    validator = ComprehensiveValidator()
    results = await validator.run_full_validation_suite()
    analysis = results['comprehensive_analysis']
    readiness = results['production_readiness']

    print(f"✅ Comprehensive validation complete:")
    print(f"   Health Score: {analysis['overall_health_score']}/100")
    print(f"   Readiness: {readiness['readiness_status']}")
    return results


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Workflow System Validation Runner")
    parser.add_argument(
        '--type', '-t',
        choices=['real-world', 'performance', 'integration', 'comprehensive'],
        default='comprehensive',
        help='Type of validation to run (default: comprehensive)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--output', '-o',
        help='Output directory for results (default: current directory)'
    )

    args = parser.parse_args()

    # Setup logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )

    # Select validation type
    validation_functions = {
        'real-world': run_real_world_tests,
        'performance': run_performance_tests,
        'integration': run_integration_tests,
        'comprehensive': run_comprehensive_validation
    }

    validation_func = validation_functions[args.type]

    try:
        # Run validation
        results = asyncio.run(validation_func())

        # Save results if output directory specified
        if args.output:
            output_dir = Path(args.output)
            output_dir.mkdir(exist_ok=True)

            import json
            results_file = output_dir / f"{args.type.replace('-', '_')}_results.json"
            results_file.write_text(json.dumps(results, indent=2))
            print(f"📁 Results saved to: {results_file}")

        # Determine exit code based on results
        if args.type == 'comprehensive':
            success = results.get('overall_success', False)
        else:
            success = results.get('success', True)

        print(f"\n🎯 Validation {'PASSED' if success else 'FAILED'}")
        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print("\n🛑 Validation interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Validation failed with error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()