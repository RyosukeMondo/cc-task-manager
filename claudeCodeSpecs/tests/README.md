# Claude Code Specification System Test Suite

Comprehensive testing framework for the Claude Code Specification System, ensuring reliability and compliance across all components.

## Overview

This test suite provides three levels of testing:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions and workflows
- **End-to-End Tests**: Test complete specification generation and validation workflows

## Test Structure

```
tests/
├── unit/                     # Unit tests for individual components
│   ├── schemas/              # JSON schema validation tests
│   ├── runtime-monitoring/   # Event capture and processing tests
│   ├── analysis/             # Behavioral analysis tests
│   ├── api/                  # API endpoint tests
│   └── validation/           # Compliance checking tests
├── integration/              # Integration workflow tests
│   └── specification-workflow.test.ts
├── e2e/                      # End-to-end system tests
│   └── claude-code-specification-system.test.ts
├── setup.ts                  # Global test setup and utilities
├── jest.config.js            # Jest configuration
├── package.json              # Test dependencies and scripts
└── README.md                 # This file
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- TypeScript 5+

### Installation

```bash
cd claudeCodeSpecs/tests
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only

# Development workflow
npm run test:watch        # Watch mode for development
npm run test:coverage     # Generate coverage report
npm run test:verbose      # Detailed test output

# CI/CD
npm run test:ci          # Optimized for CI environments
```

## Test Categories

### Unit Tests (~/unit/)

Test individual components in isolation with comprehensive coverage:

#### Schemas Tests (`unit/schemas/`)
- JSON Schema validation against Claude Code command structures
- Event schema compliance testing
- State transition schema verification
- Cross-schema compatibility validation

#### Runtime Monitoring Tests (`unit/runtime-monitoring/`)
- Event capture engine functionality
- Real-time event processing
- Memory management and performance
- Filter and enrichment logic

#### Analysis Tests (`unit/analysis/`)
- Behavioral pattern detection
- State machine generation
- Tool usage analysis
- Completion pattern recognition

#### API Tests (`unit/api/`)
- REST endpoint validation
- Request/response handling
- Authentication and authorization
- Error handling and recovery

#### Validation Tests (`unit/validation/`)
- Compliance rule engine
- Schema validation utilities
- Implementation verification
- Performance threshold checking

### Integration Tests (~/integration/)

Test component interactions and complete workflows:

- **Specification Generation Workflow**: End-to-end specification creation from captured runtime data
- **Validation Integration**: Cross-component validation of wrapper implementations
- **API Orchestration**: Coordinated API operations across multiple components
- **Performance Integration**: System-wide performance under realistic conditions

### End-to-End Tests (~/e2e/)

Test complete system functionality in realistic scenarios:

- **Complete Specification Lifecycle**: From runtime capture to specification generation and validation
- **Complex Multi-tool Workflows**: Branching logic, parallel execution, error recovery
- **Real-world Integration**: Production-like scenarios with realistic load conditions
- **Specification Evolution**: Backward compatibility and migration testing

## Test Utilities and Helpers

### Global Test Utilities (`setup.ts`)

- **Mock Event Creation**: `createMockEvent()`, `createMockCapturedEvent()`
- **Async Utilities**: `waitFor()` for timing-sensitive tests
- **File System Helpers**: `createTempDir()`, `cleanupTempDir()`
- **Process Mocking**: `mockPythonProcess()` for cross-platform testing

### Mock Implementations

Comprehensive mock implementations for testing:

- **MockEventCapture**: Runtime event capture simulation
- **MockBehaviorAnalyzer**: Pattern detection and analysis
- **MockComplianceChecker**: Validation rule execution
- **MockSpecificationAPI**: Unified API simulation

## Coverage Requirements

The test suite maintains high coverage standards:

- **Minimum Coverage**: 85% across all metrics
- **Branches**: 85% branch coverage
- **Functions**: 85% function coverage
- **Lines**: 85% line coverage
- **Statements**: 85% statement coverage

### Coverage Reports

```bash
npm run test:coverage
```

Reports are generated in multiple formats:
- HTML: `coverage/lcov-report/index.html`
- LCOV: `coverage/lcov.info`
- JSON: `coverage/coverage-final.json`
- Text: Console output

## Performance Testing

### Load Testing

Integration and E2E tests include realistic load scenarios:

- **Concurrent Users**: Up to 100 simultaneous sessions
- **Request Volume**: 50+ requests per user over 30+ minute sessions
- **Performance Thresholds**: Response time, memory usage, throughput validation

### Memory and Resource Testing

- **Memory Limits**: Tests respect 500MB limits during processing
- **Processing Time**: Individual operations complete within 100ms
- **Scalability**: Efficient handling of 10,000+ events

## Configuration

### Jest Configuration

The test suite uses Jest with TypeScript support:

- **Environment**: Node.js test environment
- **Timeout**: 30s default, 60s integration, 120s E2E
- **Parallel Execution**: 50% of available CPU cores
- **Projects**: Separate configurations for each test category

### Test Environment Variables

```bash
NODE_ENV=test              # Test environment
LOG_LEVEL=error           # Reduced logging during tests
```

## Best Practices

### Writing Tests

1. **Descriptive Test Names**: Use clear, specific test descriptions
2. **Arrange-Act-Assert**: Structure tests with clear phases
3. **Mock External Dependencies**: Isolate units under test
4. **Test Edge Cases**: Include boundary conditions and error scenarios
5. **Performance Awareness**: Keep tests fast and efficient

### Mock Data

1. **Realistic Data**: Use representative Claude Code interactions
2. **Edge Cases**: Include malformed, empty, and boundary case data
3. **Consistency**: Maintain consistent mock data across tests
4. **Cleanup**: Properly clean up test data and resources

### Async Testing

1. **Proper Awaiting**: Always await async operations
2. **Timeout Management**: Set appropriate timeouts for operations
3. **Error Handling**: Test both success and failure scenarios
4. **Race Conditions**: Account for timing-sensitive operations

## Debugging Tests

### Common Issues

1. **Timeout Errors**: Increase test timeout or optimize async operations
2. **Mock Issues**: Verify mock setup and reset between tests
3. **Resource Leaks**: Ensure proper cleanup of temporary resources
4. **Flaky Tests**: Identify and fix timing-dependent test logic

### Debugging Tools

```bash
# Run specific test file
npm test -- unit/schemas/schema-validation.test.ts

# Debug mode with increased timeout
npm test -- --testTimeout=60000 --verbose

# Run tests matching pattern
npm test -- --testNamePattern="should validate"
```

## Contributing

### Adding New Tests

1. **Create Test File**: Follow naming convention `*.test.ts`
2. **Add Appropriate Setup**: Include necessary imports and setup
3. **Write Comprehensive Tests**: Cover success, failure, and edge cases
4. **Update Documentation**: Add test descriptions to this README
5. **Verify Coverage**: Ensure new code meets coverage requirements

### Test Review Checklist

- [ ] Tests follow naming conventions
- [ ] Comprehensive coverage of functionality
- [ ] Proper setup and cleanup
- [ ] Mock dependencies appropriately
- [ ] Include performance considerations
- [ ] Document complex test logic
- [ ] Verify tests pass in CI environment

## Continuous Integration

The test suite is designed for CI/CD environments:

### CI Script

```bash
npm run setup          # Install dependencies and build
npm run lint           # Code quality checks
npm run test:ci        # Optimized test execution
```

### Performance in CI

- **Parallel Execution**: Tests run efficiently across multiple workers
- **Resource Management**: Respects CI memory and CPU constraints
- **Timeout Handling**: Appropriate timeouts for CI environments
- **Artifact Generation**: Coverage reports and test results

## Maintenance

### Regular Maintenance Tasks

1. **Dependency Updates**: Keep test dependencies current
2. **Coverage Review**: Monitor and improve coverage metrics
3. **Performance Monitoring**: Track test execution times
4. **Mock Data Updates**: Keep mock data representative of real usage

### Troubleshooting

For issues with the test suite:

1. **Check Dependencies**: Verify all dependencies are installed
2. **Clear Cache**: `npm run clean && npm install`
3. **Update Node.js**: Ensure compatible Node.js version
4. **Review Logs**: Check detailed error messages and stack traces

## Future Enhancements

Planned improvements to the test suite:

- **Property-based Testing**: Add generative testing for edge cases
- **Visual Testing**: Screenshot comparison for UI components
- **Performance Benchmarking**: Automated performance regression testing
- **Cross-platform Testing**: Extended platform compatibility validation
- **Mutation Testing**: Verify test effectiveness through mutation testing