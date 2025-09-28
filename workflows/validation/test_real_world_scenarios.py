#!/usr/bin/env python3
"""
Real-world scenario testing for workflow system.

This module validates all workflow types against realistic project scenarios
to ensure they function correctly in production environments.
"""

import asyncio
import tempfile
import shutil
import subprocess
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Any
import json
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.workflow_engine import WorkflowEngine
from core.base_workflow import WorkflowConfig
from definitions.spec_workflow import SpecWorkflow
from definitions.test_fix_workflow import TestFixWorkflow
from definitions.type_fix_workflow import TypeFixWorkflow
from definitions.build_fix_workflow import BuildFixWorkflow

logger = logging.getLogger(__name__)


class RealWorldScenarioTester:
    """Tests workflow system against real-world scenarios."""

    def __init__(self):
        self.test_results: List[Dict[str, Any]] = []
        self.temp_dirs: List[Path] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Clean up temporary directories."""
        for temp_dir in self.temp_dirs:
            if temp_dir.exists():
                shutil.rmtree(temp_dir)

    async def run_all_scenarios(self) -> Dict[str, Any]:
        """
        Run all real-world test scenarios.

        Returns:
            Dict with test results and summary
        """
        logger.info("🧪 Starting real-world scenario tests...")

        scenarios = [
            ("JavaScript Project with Tests", self.test_javascript_project),
            ("TypeScript Project with Type Errors", self.test_typescript_project),
            ("Python Project with Tests", self.test_python_project),
            ("Multi-language Project", self.test_multilang_project),
            ("Legacy Project Migration", self.test_legacy_project),
            ("Spec Workflow Integration", self.test_spec_workflow_integration)
        ]

        results = []
        for scenario_name, test_func in scenarios:
            logger.info(f"🔍 Testing: {scenario_name}")
            try:
                result = await test_func()
                result['scenario'] = scenario_name
                result['status'] = 'passed' if result['success'] else 'failed'
                results.append(result)
                logger.info(f"✅ {scenario_name}: {'PASSED' if result['success'] else 'FAILED'}")
            except Exception as e:
                logger.error(f"❌ {scenario_name}: ERROR - {e}")
                results.append({
                    'scenario': scenario_name,
                    'status': 'error',
                    'success': False,
                    'error': str(e),
                    'execution_time': 0
                })

        # Calculate summary statistics
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r['status'] == 'passed')
        failed_tests = sum(1 for r in results if r['status'] == 'failed')
        error_tests = sum(1 for r in results if r['status'] == 'error')

        summary = {
            'total_scenarios': total_tests,
            'passed': passed_tests,
            'failed': failed_tests,
            'errors': error_tests,
            'success_rate': (passed_tests / total_tests) * 100 if total_tests > 0 else 0,
            'results': results
        }

        logger.info(f"📊 Test Summary: {passed_tests}/{total_tests} passed ({summary['success_rate']:.1f}%)")
        return summary

    def create_test_project(self, project_type: str) -> Path:
        """Create a temporary test project of the specified type."""
        temp_dir = Path(tempfile.mkdtemp(prefix=f"workflow_test_{project_type}_"))
        self.temp_dirs.append(temp_dir)
        return temp_dir

    async def test_javascript_project(self) -> Dict[str, Any]:
        """Test JavaScript project with failing tests."""
        start_time = asyncio.get_event_loop().time()

        project_dir = self.create_test_project("javascript")

        # Create package.json
        package_json = {
            "name": "test-project",
            "version": "1.0.0",
            "scripts": {
                "test": "jest",
                "build": "webpack"
            },
            "devDependencies": {
                "jest": "^29.0.0",
                "webpack": "^5.0.0"
            }
        }
        (project_dir / "package.json").write_text(json.dumps(package_json, indent=2))

        # Create a simple source file
        (project_dir / "src").mkdir()
        (project_dir / "src" / "utils.js").write_text("""
function add(a, b) {
    return a + b;  // Intentional bug: should handle edge cases
}

function multiply(a, b) {
    return a * b;
}

module.exports = { add, multiply };
""")

        # Create failing test
        (project_dir / "test").mkdir()
        (project_dir / "test" / "utils.test.js").write_text("""
const { add, multiply } = require('../src/utils');

describe('Utils', () => {
    test('add function should handle numbers', () => {
        expect(add(2, 3)).toBe(5);
        expect(add(0, 0)).toBe(0);
        expect(add(-1, 1)).toBe(0);
    });

    test('add function should handle edge cases', () => {
        expect(add(null, 5)).toBe(5);  // This will fail
        expect(add(undefined, 5)).toBe(5);  // This will fail
    });

    test('multiply function works', () => {
        expect(multiply(2, 3)).toBe(6);
        expect(multiply(0, 5)).toBe(0);
    });
});
""")

        # Test test-fix workflow
        config = WorkflowConfig(
            workflow_type='test-fix',
            project_path=project_dir,
            test_command='npm test',
            max_cycles=3,
            debug_options={'show_tool_details': True}
        )

        workflow = TestFixWorkflow(config)
        engine = WorkflowEngine(project_dir, config.debug_options)

        try:
            success = await engine.execute_workflow(workflow)
            execution_time = asyncio.get_event_loop().time() - start_time

            return {
                'success': success,
                'execution_time': execution_time,
                'workflow_type': 'test-fix',
                'project_type': 'javascript',
                'details': 'JavaScript project with intentionally failing tests'
            }
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            return {
                'success': False,
                'execution_time': execution_time,
                'workflow_type': 'test-fix',
                'project_type': 'javascript',
                'error': str(e)
            }

    async def test_typescript_project(self) -> Dict[str, Any]:
        """Test TypeScript project with type errors."""
        start_time = asyncio.get_event_loop().time()

        project_dir = self.create_test_project("typescript")

        # Create package.json
        package_json = {
            "name": "typescript-test-project",
            "version": "1.0.0",
            "scripts": {
                "build": "tsc",
                "test": "jest"
            },
            "devDependencies": {
                "typescript": "^5.0.0",
                "@types/node": "^20.0.0"
            }
        }
        (project_dir / "package.json").write_text(json.dumps(package_json, indent=2))

        # Create tsconfig.json
        tsconfig = {
            "compilerOptions": {
                "target": "ES2020",
                "module": "commonjs",
                "strict": True,
                "outDir": "./dist",
                "rootDir": "./src"
            },
            "include": ["src/**/*"],
            "exclude": ["node_modules", "dist"]
        }
        (project_dir / "tsconfig.json").write_text(json.dumps(tsconfig, indent=2))

        # Create source files with type errors
        (project_dir / "src").mkdir()
        (project_dir / "src" / "index.ts").write_text("""
interface User {
    id: number;
    name: string;
    email: string;
}

function processUser(user: User): string {
    // Type error: accessing non-existent property
    return `Processing ${user.firstName} (${user.email})`;  // Should be user.name
}

function calculateAge(birthYear: number): number {
    const currentYear = new Date().getFullYear();
    // Type error: string + number
    return currentYear - birthYear + "years";  // Should return number
}

// Type error: missing properties
const testUser: User = {
    id: 1,
    name: "John Doe"
    // missing email property
};

export { processUser, calculateAge, testUser };
""")

        # Test type-fix workflow
        config = WorkflowConfig(
            workflow_type='type-fix',
            project_path=project_dir,
            type_check_command='npx tsc --noEmit',
            max_cycles=5,
            debug_options={'show_tool_details': True}
        )

        workflow = TypeFixWorkflow(config)
        engine = WorkflowEngine(project_dir, config.debug_options)

        try:
            success = await engine.execute_workflow(workflow)
            execution_time = asyncio.get_event_loop().time() - start_time

            return {
                'success': success,
                'execution_time': execution_time,
                'workflow_type': 'type-fix',
                'project_type': 'typescript',
                'details': 'TypeScript project with intentional type errors'
            }
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            return {
                'success': False,
                'execution_time': execution_time,
                'workflow_type': 'type-fix',
                'project_type': 'typescript',
                'error': str(e)
            }

    async def test_python_project(self) -> Dict[str, Any]:
        """Test Python project with failing tests."""
        start_time = asyncio.get_event_loop().time()

        project_dir = self.create_test_project("python")

        # Create Python package structure
        (project_dir / "src").mkdir()
        (project_dir / "src" / "__init__.py").write_text("")

        # Create source file with bugs
        (project_dir / "src" / "calculator.py").write_text("""
def divide(a, b):
    return a / b  # No zero division check

def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n - 1)  # No input validation

class Calculator:
    def __init__(self):
        self.history = []

    def add(self, a, b):
        result = a + b
        self.history.append(f"{a} + {b} = {result}")
        return result

    def get_last_operation(self):
        return self.history[-1]  # No bounds checking
""")

        # Create failing tests
        (project_dir / "tests").mkdir()
        (project_dir / "tests" / "__init__.py").write_text("")
        (project_dir / "tests" / "test_calculator.py").write_text("""
import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from calculator import divide, factorial, Calculator

def test_divide():
    assert divide(10, 2) == 5
    assert divide(7, 3) == pytest.approx(2.333, rel=1e-2)

    # This will fail due to ZeroDivisionError
    with pytest.raises(ZeroDivisionError):
        divide(5, 0)

def test_factorial():
    assert factorial(0) == 1
    assert factorial(5) == 120

    # This should handle negative numbers gracefully
    with pytest.raises(ValueError):
        factorial(-1)

def test_calculator():
    calc = Calculator()
    assert calc.add(2, 3) == 5
    assert calc.get_last_operation() == "2 + 3 = 5"

    # This should handle empty history gracefully
    empty_calc = Calculator()
    with pytest.raises(IndexError):
        empty_calc.get_last_operation()
""")

        # Create pytest config
        (project_dir / "pytest.ini").write_text("""
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
""")

        # Test test-fix workflow
        config = WorkflowConfig(
            workflow_type='test-fix',
            project_path=project_dir,
            test_command='python -m pytest tests/ -v',
            max_cycles=5,
            debug_options={'show_tool_details': True}
        )

        workflow = TestFixWorkflow(config)
        engine = WorkflowEngine(project_dir, config.debug_options)

        try:
            success = await engine.execute_workflow(workflow)
            execution_time = asyncio.get_event_loop().time() - start_time

            return {
                'success': success,
                'execution_time': execution_time,
                'workflow_type': 'test-fix',
                'project_type': 'python',
                'details': 'Python project with failing tests requiring error handling'
            }
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            return {
                'success': False,
                'execution_time': execution_time,
                'workflow_type': 'test-fix',
                'project_type': 'python',
                'error': str(e)
            }

    async def test_multilang_project(self) -> Dict[str, Any]:
        """Test multi-language project with build issues."""
        start_time = asyncio.get_event_loop().time()

        project_dir = self.create_test_project("multilang")

        # Create a mixed project with build issues
        # Frontend (React/TypeScript)
        (project_dir / "frontend").mkdir()
        (project_dir / "frontend" / "package.json").write_text(json.dumps({
            "name": "frontend",
            "scripts": {"build": "webpack"},
            "dependencies": {"react": "^18.0.0"}
        }, indent=2))

        # Backend (Python)
        (project_dir / "backend").mkdir()
        (project_dir / "backend" / "requirements.txt").write_text("flask==2.3.0\n")

        # Root build configuration with intentional issues
        (project_dir / "Makefile").write_text("""
all: frontend backend

frontend:
\tcd frontend && npm install && npm run build

backend:
\tcd backend && pip install -r requirements.txt && python -m pytest

# Intentional error - missing dependency
build:
\tmake frontend backend
\t./scripts/missing_script.sh  # This will fail

.PHONY: all frontend backend build
""")

        config = WorkflowConfig(
            workflow_type='build-fix',
            project_path=project_dir,
            build_command='make build',
            max_cycles=3,
            debug_options={'show_tool_details': True}
        )

        workflow = BuildFixWorkflow(config)
        engine = WorkflowEngine(project_dir, config.debug_options)

        try:
            success = await engine.execute_workflow(workflow)
            execution_time = asyncio.get_event_loop().time() - start_time

            return {
                'success': success,
                'execution_time': execution_time,
                'workflow_type': 'build-fix',
                'project_type': 'multilang',
                'details': 'Multi-language project with complex build dependencies'
            }
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            return {
                'success': False,
                'execution_time': execution_time,
                'workflow_type': 'build-fix',
                'project_type': 'multilang',
                'error': str(e)
            }

    async def test_legacy_project(self) -> Dict[str, Any]:
        """Test legacy project migration scenario."""
        start_time = asyncio.get_event_loop().time()

        project_dir = self.create_test_project("legacy")

        # Create legacy JavaScript project structure
        (project_dir / "gulpfile.js").write_text("""
const gulp = require('gulp');
const babel = require('gulp-babel');  // Old build system

gulp.task('build', () => {
    return gulp.src('src/**/*.js')
        .pipe(babel({
            presets: ['@babel/preset-env']  // Outdated preset
        }))
        .pipe(gulp.dest('dist'));
});

gulp.task('default', gulp.series('build'));
""")

        (project_dir / "package.json").write_text(json.dumps({
            "name": "legacy-project",
            "version": "1.0.0",
            "scripts": {
                "build": "gulp build",
                "test": "mocha test/*.test.js"
            },
            "devDependencies": {
                "gulp": "^4.0.0",
                "gulp-babel": "^8.0.0",
                "@babel/core": "^7.0.0",
                "@babel/preset-env": "^7.0.0",
                "mocha": "^10.0.0"
            }
        }, indent=2))

        # Legacy source code
        (project_dir / "src").mkdir()
        (project_dir / "src" / "legacy.js").write_text("""
// Legacy ES5 code with issues
var LegacyModule = function() {
    this.data = [];
};

LegacyModule.prototype.addItem = function(item) {
    this.data.push(item);
    return this.data.length;  // No validation
};

LegacyModule.prototype.getItem = function(index) {
    return this.data[index];  // No bounds checking
};

// Missing export for modern systems
if (typeof module !== 'undefined') {
    module.exports = LegacyModule;
}
""")

        config = WorkflowConfig(
            workflow_type='build-fix',
            project_path=project_dir,
            build_command='npm run build',
            max_cycles=4,
            debug_options={'show_tool_details': True}
        )

        workflow = BuildFixWorkflow(config)
        engine = WorkflowEngine(project_dir, config.debug_options)

        try:
            success = await engine.execute_workflow(workflow)
            execution_time = asyncio.get_event_loop().time() - start_time

            return {
                'success': success,
                'execution_time': execution_time,
                'workflow_type': 'build-fix',
                'project_type': 'legacy',
                'details': 'Legacy project with outdated build system and dependencies'
            }
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            return {
                'success': False,
                'execution_time': execution_time,
                'workflow_type': 'build-fix',
                'project_type': 'legacy',
                'error': str(e)
            }

    async def test_spec_workflow_integration(self) -> Dict[str, Any]:
        """Test spec workflow integration with the new system."""
        start_time = asyncio.get_event_loop().time()

        project_dir = self.create_test_project("spec_integration")

        # Create a basic project structure for spec workflow
        (project_dir / ".spec-workflow").mkdir()
        (project_dir / ".spec-workflow" / "specs").mkdir()
        (project_dir / ".spec-workflow" / "specs" / "test-feature").mkdir()

        # Create minimal spec files
        (project_dir / ".spec-workflow" / "specs" / "test-feature" / "requirements.md").write_text("""
# Test Feature Requirements

## User Stories
- As a user, I want to test the spec workflow system
- As a developer, I want to validate integration works correctly

## Acceptance Criteria
- System can process spec workflow requests
- Tasks are properly managed and tracked
- Integration with new workflow system is seamless
""")

        (project_dir / ".spec-workflow" / "specs" / "test-feature" / "tasks.md").write_text("""
# Test Feature Tasks

- [x] 1. Create basic project structure
- [ ] 2. Implement simple feature
- [ ] 3. Add tests for the feature
""")

        config = WorkflowConfig(
            workflow_type='spec',
            project_path=project_dir,
            spec_name='test-feature',
            max_cycles=2,
            debug_options={'show_tool_details': True}
        )

        workflow = SpecWorkflow(config)
        engine = WorkflowEngine(project_dir, config.debug_options)

        try:
            success = await engine.execute_workflow(workflow)
            execution_time = asyncio.get_event_loop().time() - start_time

            return {
                'success': success,
                'execution_time': execution_time,
                'workflow_type': 'spec',
                'project_type': 'spec_integration',
                'details': 'Spec workflow integration test with new system architecture'
            }
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            return {
                'success': False,
                'execution_time': execution_time,
                'workflow_type': 'spec',
                'project_type': 'spec_integration',
                'error': str(e)
            }


async def main():
    """Run real-world scenario tests."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )

    with RealWorldScenarioTester() as tester:
        results = await tester.run_all_scenarios()

        # Save results
        results_file = Path(__file__).parent / "real_world_test_results.json"
        results_file.write_text(json.dumps(results, indent=2))

        print(f"\n📊 Real-world testing complete!")
        print(f"Results saved to: {results_file}")
        print(f"Success rate: {results['success_rate']:.1f}%")

        if results['success_rate'] < 100:
            print("\n❌ Some tests failed:")
            for result in results['results']:
                if result['status'] != 'passed':
                    print(f"  - {result['scenario']}: {result['status']}")
                    if 'error' in result:
                        print(f"    Error: {result['error']}")

        return results['success_rate'] >= 80  # 80% success rate threshold


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)