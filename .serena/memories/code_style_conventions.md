# Code Style and Conventions

## TypeScript Style
- **Naming Convention**: camelCase for variables/functions, PascalCase for classes/interfaces
- **File Naming**: kebab-case for files (e.g., `contract-registry.ts`)
- **Import Organization**: External imports first, then internal imports
- **Type Definitions**: Explicit types preferred, leverage Zod inference where appropriate

## NestJS Patterns
- **Dependency Injection**: Use constructor injection with proper decorators
- **Module Structure**: Feature-based modules with clear boundaries
- **Service Classes**: Single responsibility, injectable services
- **Controller Pattern**: Thin controllers, business logic in services
- **Validation**: Use Zod schemas with NestJS ValidationPipe

## Contract-Driven Patterns
- **Schema First**: Define Zod schemas before implementation
- **Version Management**: Semantic versioning for contracts
- **Documentation**: Auto-generated from contracts, not manual
- **Validation**: Runtime validation at API boundaries

## Testing Conventions
- **File Naming**: `*.spec.ts` for unit tests, `*.test.ts` for integration
- **Test Structure**: Arrange-Act-Assert pattern
- **Mocking**: Use Jest mocks, avoid real external dependencies
- **Contract Testing**: Pact for consumer-driven contracts

## Error Handling
- **Structured Errors**: Use NestJS exception filters
- **Logging**: Pino logger with structured logging
- **Validation Errors**: Clear, actionable error messages
- **HTTP Status**: Proper status codes for different error types