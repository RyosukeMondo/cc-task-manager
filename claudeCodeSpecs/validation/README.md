# Claude Code Wrapper Specification Validation Tools

This directory contains comprehensive validation and compliance testing tools for Claude Code wrapper implementations. These tools ensure that wrapper implementations follow the formal specifications and behavioral contracts defined in the Claude Code specification system.

## Requirements Satisfied

- **5.1**: Schema validation with detailed error reporting
- **5.2**: Regression testing to ensure backward compatibility
- **5.3**: Validation tools for wrapper implementations
- **5.4**: Versioning and migration guides support

## Components

### 1. Schema Validator (`schema-validator.py`)

JSON Schema validator for Claude Code wrapper communications.

**Features:**
- Validates commands, events, and state data against formal JSON schemas
- Provides detailed error reporting with field-level feedback
- Supports batch validation for multiple data items
- CLI interface for standalone validation

**Usage:**
```bash
# Validate a command JSON file
python schema-validator.py commands path/to/command.json

# Validate an event JSON file
python schema-validator.py events path/to/event.json

# Validate state data
python schema-validator.py states path/to/state.json
```

**Python API:**
```python
from schema_validator import SchemaValidator

validator = SchemaValidator()

# Validate command
result = validator.validate_command(command_data)
if result.is_valid:
    print("Command is valid")
else:
    print(f"Validation errors: {result.errors}")
```

### 2. Compliance Checker (`compliance-checker.py`)

Comprehensive compliance testing for wrapper implementations against behavioral specifications.

**Features:**
- Multiple compliance levels: Basic, Standard, Comprehensive
- Protocol compliance validation (schema adherence, required commands/events)
- Behavioral compliance validation (session lifecycle, error handling)
- Advanced compliance validation (concurrency, resource cleanup)
- Detailed reporting with actionable recommendations

**Usage:**
```bash
# Basic compliance check
python compliance-checker.py /path/to/wrapper --level=basic

# Standard compliance check (default)
python compliance-checker.py /path/to/wrapper

# Comprehensive compliance check
python compliance-checker.py /path/to/wrapper --level=comprehensive --working-dir=/path/to/test/dir
```

**Compliance Levels:**
- **Basic**: Protocol and schema validation only
- **Standard**: Includes behavioral pattern validation
- **Comprehensive**: Full state machine and edge case validation

### 3. Test Runner (`test-runner.py`)

Automated test execution and reporting system for validation workflows.

**Features:**
- Multiple test suites: Schema, Compliance, Full Validation, Regression
- Parallel test execution for performance
- CI/CD integration support (JUnit XML, GitHub Actions)
- Comprehensive reporting with performance metrics
- Configurable test environments

**Usage:**
```bash
# Run schema validation tests only
python test-runner.py schema

# Run compliance tests for configured wrappers
python test-runner.py compliance --wrappers=wrapper-configs.json

# Run full validation suite
python test-runner.py full --wrappers=wrapper-configs.json

# Run regression tests
python test-runner.py regression
```

**Configuration:**
Create a `test-config.json` file:
```json
{
  "timeout": 30,
  "parallel_execution": true,
  "max_workers": 4,
  "results_dir": "claudeCodeSpecs/validation/results",
  "test_data_dir": "claudeCodeSpecs/validation/test-data",
  "generate_html_report": true,
  "ci_integration": {
    "junit_xml": true,
    "github_actions": true
  }
}
```

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure the JSON schemas are available in `claudeCodeSpecs/schemas/`:
   - `commands.json`
   - `events.json`
   - `states.json`

## Test Data Structure

Organize test data for schema validation:

```
claudeCodeSpecs/validation/test-data/
├── commands/
│   ├── valid/
│   │   ├── prompt_command.json
│   │   ├── cancel_command.json
│   │   └── status_command.json
│   └── invalid/
│       ├── missing_action.json
│       ├── invalid_action.json
│       └── malformed_options.json
├── events/
│   ├── valid/
│   │   ├── ready_event.json
│   │   ├── run_started_event.json
│   │   └── run_completed_event.json
│   └── invalid/
│       ├── missing_event_field.json
│       └── invalid_event_type.json
└── states/
    ├── valid/
    │   └── session_state.json
    └── invalid/
        └── invalid_state.json
```

## Wrapper Configuration

For compliance testing, create a wrapper configuration file:

```json
[
  {
    "name": "python-wrapper",
    "path": "/path/to/python/wrapper.py",
    "level": "standard",
    "working_dir": "/path/to/test/workspace",
    "timeout": 60
  },
  {
    "name": "nodejs-wrapper",
    "path": "/path/to/node/wrapper.js",
    "level": "comprehensive",
    "working_dir": "/path/to/test/workspace",
    "timeout": 90
  }
]
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Wrapper Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.9
      - name: Install dependencies
        run: |
          cd claudeCodeSpecs/validation
          pip install -r requirements.txt
      - name: Run validation tests
        run: |
          cd claudeCodeSpecs/validation
          python test-runner.py full --wrappers=ci-wrapper-configs.json
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Validation') {
            steps {
                dir('claudeCodeSpecs/validation') {
                    sh 'pip install -r requirements.txt'
                    sh 'python test-runner.py full --wrappers=wrapper-configs.json'
                }
            }
            post {
                always {
                    publishTestResults testResultsPattern: 'claudeCodeSpecs/validation/results/*.xml'
                }
            }
        }
    }
}
```

## Output Formats

### JSON Report
```json
{
  "wrapper_name": "python-wrapper",
  "validation_date": "2025-09-28 15:30:00",
  "compliance_level": "standard",
  "overall_status": "pass",
  "compliance_score": 95.5,
  "passed_checks": ["schema_command_validation", "session_lifecycle_compliance"],
  "failed_checks": [],
  "warnings": [],
  "recommendations": [],
  "test_summary": {
    "total_checks": 8,
    "passed": 7,
    "failed": 0,
    "warnings": 1,
    "skipped": 0
  }
}
```

### Test Suite Results
```json
{
  "suite_name": "full",
  "start_time": "2025-09-28 15:30:00",
  "end_time": "2025-09-28 15:32:15",
  "duration_seconds": 135.4,
  "total_tests": 25,
  "passed_tests": 23,
  "failed_tests": 1,
  "error_tests": 0,
  "skipped_tests": 1,
  "overall_result": "fail"
}
```

## Best Practices

1. **Schema Validation**: Always validate data structures before behavioral testing
2. **Incremental Testing**: Start with basic compliance before advanced features
3. **Test Data Management**: Maintain comprehensive test data covering edge cases
4. **CI Integration**: Run validation tests on every code change
5. **Baseline Management**: Establish regression baselines for consistent validation
6. **Error Analysis**: Review failed tests systematically to improve wrapper quality

## Troubleshooting

### Common Issues

1. **Schema File Not Found**: Ensure schemas are generated in `claudeCodeSpecs/schemas/`
2. **Wrapper Process Fails**: Check wrapper executable permissions and dependencies
3. **Timeout Errors**: Increase timeout values for complex wrapper operations
4. **Permission Errors**: Ensure proper file system permissions for test directories

### Debug Mode

Enable verbose logging by setting environment variables:
```bash
export CLAUDE_VALIDATION_DEBUG=1
export CLAUDE_VALIDATION_LOG_LEVEL=DEBUG
```

## Contributing

When adding new validation checks:

1. Add test cases to the appropriate checker class
2. Update compliance levels as needed
3. Add corresponding test data files
4. Update documentation and examples
5. Ensure backward compatibility with existing wrappers