# Requirements Document - Backend Settings API

## Introduction

The Backend Settings API provides user preferences and configuration management endpoints. This API enables persistent storage of user-specific settings (theme, notifications, display preferences) and replaces hardcoded user identifiers with proper JWT-based user context.

**Purpose**: Implement `/api/settings` endpoints that return and update user preferences with automatic default creation.

**Value**: Enables users to customize their experience, fixes hardcoded 'current-user' issue, and provides foundation for per-user configuration across the application.

## Alignment with Product Vision

From `product.md`:
- **"Customizable Interface"**: User preferences for theme, notifications, display options
- **"Personalization"**: Per-user settings isolated by JWT authentication
- **"Zero Configuration"**: Auto-create default settings on first access (no setup required)

This spec addresses the gap: "Settings API returns 404 - `/api/settings/current-user` endpoint missing, hardcoded userId detected" (from IMPLEMENTATION_GAP_ANALYSIS.md)

## Requirements

### Requirement 1: Get User Settings

**User Story:** As a logged-in user, I want to retrieve my settings, so that the UI can apply my preferences (theme, notifications, etc.)

#### Acceptance Criteria (EARS)

1. WHEN client GETs `/api/settings` with valid JWT THEN system SHALL return 200 OK with settings object
2. WHEN user has no settings record THEN system SHALL auto-create default settings before returning
3. WHEN settings are auto-created THEN system SHALL use userId from JWT context (not 'current-user')
4. WHEN settings are returned THEN system SHALL include theme, notifications, displayDensity, language
5. WHEN JWT is invalid/missing THEN system SHALL return 401 Unauthorized
6. WHEN default settings are created THEN system SHALL use values: theme='system', notifications=true, displayDensity='comfortable', language='en'

### Requirement 2: Update User Settings

**User Story:** As a logged-in user, I want to update my preferences, so that my customizations persist across sessions

#### Acceptance Criteria (EARS)

1. WHEN client PATCHes `/api/settings` with valid updates THEN system SHALL return 200 OK with updated settings
2. WHEN partial updates are sent THEN system SHALL update only specified fields (not require all fields)
3. WHEN settings do not exist THEN system SHALL create them with provided values + defaults for omitted fields
4. WHEN update data is invalid THEN system SHALL return 400 Bad Request with validation errors
5. WHEN settings are updated THEN system SHALL update `updatedAt` timestamp automatically
6. WHEN userId from JWT does not match settings owner THEN system SHALL return 403 Forbidden

### Requirement 3: Settings Validation

**User Story:** As a system, I want to validate settings values, so that invalid configurations cannot be saved

#### Acceptance Criteria (EARS)

1. WHEN theme field is provided THEN system SHALL validate it is one of: 'light', 'dark', 'system'
2. WHEN displayDensity is provided THEN system SHALL validate it is one of: 'comfortable', 'compact', 'spacious'
3. WHEN language is provided THEN system SHALL validate it is a valid ISO 639-1 code (en, es, fr, etc.)
4. WHEN notifications is provided THEN system SHALL validate it is a boolean
5. WHEN invalid enum value is sent THEN system SHALL return 400 Bad Request with allowed values

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: Separate SettingsController (HTTP), SettingsService (business logic + auto-create), repository
- **Modular Design**: NestJS module isolated in `apps/backend/src/settings/` with clear boundaries
- **Dependency Management**: Use NestJS DI for SettingsService, PrismaService
- **Clear Interfaces**: DTOs define update schema, entity defines database model
- **File Ownership**: This spec owns all files in `apps/backend/src/settings/**/*` (zero conflicts)

### Contract-Driven Development
- **Schema First**: Define Zod schemas in `@cc-task-manager/schemas/src/settings.schema.ts`
- **SSOT**: Zod schemas generate TypeScript types AND validate update requests
- **API Contract**: All endpoints match contract-client.ts expectations
- **Default Values**: Defined in schema and enforced by database defaults

### Performance
- **Response Time**: < 100ms for 95th percentile requests (simple CRUD)
- **Auto-Create Optimization**: Use Prisma upsert to avoid race conditions
- **Caching**: No caching (settings change infrequently, always fetch fresh)
- **Query Efficiency**: Use `findUnique` with userId index

### Security
- **Authentication**: All endpoints protected with JwtAuthGuard (require valid JWT)
- **Authorization**: Users can ONLY access their own settings (userId from JWT)
- **Input Validation**: Zod schemas validate all enum values and types
- **SQL Injection Prevention**: Prisma ORM parameterizes all queries
- **No User Enumeration**: Never return 404 for missing settings (auto-create instead)

### Reliability
- **Error Handling**: Return proper HTTP status codes (200, 400, 401, 403, 500)
- **Race Condition Safety**: Use Prisma upsert for concurrent GET requests from same user
- **Idempotency**: Update operations are idempotent (same request = same result)
- **Logging**: Log settings updates for audit trail

### Usability
- **Error Messages**: Return user-friendly validation error messages with allowed values
- **Consistent Format**: All responses follow standard ApiResponse<T> format
- **Documentation**: OpenAPI spec auto-generated from Zod schemas
- **Testing**: E2E tests in `apps/frontend/e2e/settings-api.spec.ts` validate all flows

### Environment-Driven Configuration
- **Feature Flag**: `SETTINGS_API_ENABLED=true` to enable/disable API
- **Default Theme**: `SETTINGS_DEFAULT_THEME=system`
- **Default Language**: `SETTINGS_DEFAULT_LANGUAGE=en`

## Success Criteria

- ✅ `/api/settings` returns 200 with user settings (no 404)
- ✅ Settings page displays real user preferences (no hardcoded 'current-user')
- ✅ Theme changes persist across sessions
- ✅ First-time users get default settings automatically (no setup required)
- ✅ Settings are isolated per user (userId from JWT)
- ✅ E2E tests validate CRUD operations

## Dependencies

**Blocked By**:
- `backend-auth-api` - Requires JwtAuthGuard and userId from JWT context

**Blocks**:
- `settings-page` - Frontend needs `/api/settings` endpoint to display preferences

**Shared Files** (Append-only, no conflicts):
- `prisma/schema.prisma` - Add Settings model with userId FK
- `apps/frontend/src/lib/api/contract-client.ts` - Add settings methods (getSettings, updateSettings)
