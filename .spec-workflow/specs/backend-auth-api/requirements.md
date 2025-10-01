# Requirements Document - Backend Auth API

## Introduction

The Backend Auth API provides authentication and authorization endpoints for user registration, login, session management, and JWT token issuance. This API replaces hardcoded user identifiers and enables proper multi-user support with secure password handling.

**Purpose**: Implement `/api/auth` endpoints that handle user authentication, JWT token management, and session lifecycle.

**Value**: Enables secure user authentication, eliminates hardcoded 'current-user' IDs, and provides foundation for authorization across all protected endpoints.

## Alignment with Product Vision

From `product.md` and `tech.md`:
- **"Multi-user Support"**: JWT-based authentication enables proper user isolation
- **"Security"**: Bcrypt password hashing with 10 rounds, JWT expiration policies
- **"Session Management"**: Persistent sessions with refresh token support
- **"Real-time Auth"**: WebSocket authentication via JWT token validation

This spec addresses the critical gap: "Authentication system completely missing - login page shows 'Cannot connect to server', no `/api/auth/login` endpoint" (from IMPLEMENTATION_GAP_ANALYSIS.md)

## Requirements

### Requirement 1: User Registration

**User Story:** As a new user, I want to register an account with email and password, so that I can access the task management system

#### Acceptance Criteria (EARS)

1. WHEN client POSTs to `/api/auth/register` with email and password THEN system SHALL create user account
2. WHEN password is received THEN system SHALL hash it with bcrypt (10 rounds) before storage
3. WHEN email already exists THEN system SHALL return 409 Conflict with error message
4. WHEN password is weak (<8 chars, no special chars) THEN system SHALL return 400 Bad Request
5. WHEN registration succeeds THEN system SHALL return 201 Created with user object (excluding password)
6. WHEN user is created THEN system SHALL NOT return JWT token (require explicit login)

### Requirement 2: User Login

**User Story:** As a registered user, I want to log in with email and password, so that I can access my tasks and settings

#### Acceptance Criteria (EARS)

1. WHEN client POSTs to `/api/auth/login` with valid credentials THEN system SHALL return 200 OK with JWT token
2. WHEN password matches THEN system SHALL use bcrypt.compare() for verification
3. WHEN credentials are invalid THEN system SHALL return 401 Unauthorized with generic error message
4. WHEN login succeeds THEN system SHALL create Session record in database
5. WHEN JWT token is issued THEN system SHALL set expiration to 7 days
6. WHEN JWT is created THEN system SHALL include payload: userId, email, iat, exp
7. WHEN login succeeds THEN system SHALL return both accessToken (JWT) and refreshToken

### Requirement 3: Token Refresh

**User Story:** As a user with expired access token, I want to refresh my token without re-entering credentials, so that my session persists seamlessly

#### Acceptance Criteria (EARS)

1. WHEN client POSTs to `/api/auth/refresh` with valid refreshToken THEN system SHALL issue new accessToken
2. WHEN refreshToken is expired THEN system SHALL return 401 Unauthorized
3. WHEN refreshToken does not match database session THEN system SHALL return 401 Unauthorized
4. WHEN refresh succeeds THEN system SHALL update Session.lastActive timestamp
5. WHEN new accessToken is issued THEN system SHALL maintain same userId and permissions

### Requirement 4: Logout

**User Story:** As a logged-in user, I want to log out, so that my session is terminated securely

#### Acceptance Criteria (EARS)

1. WHEN client POSTs to `/api/auth/logout` with valid JWT THEN system SHALL invalidate session
2. WHEN session is invalidated THEN system SHALL set Session.deletedAt timestamp (soft delete)
3. WHEN logout succeeds THEN system SHALL return 204 No Content
4. WHEN JWT is invalid/expired THEN system SHALL return 401 Unauthorized
5. WHEN session is invalidated THEN system SHALL prevent refreshToken from generating new tokens

### Requirement 5: Get Current User

**User Story:** As an authenticated user, I want to retrieve my profile information, so that the UI can display my account details

#### Acceptance Criteria (EARS)

1. WHEN client GETs `/api/auth/me` with valid JWT THEN system SHALL return 200 OK with user object
2. WHEN user object is returned THEN system SHALL exclude password field
3. WHEN JWT is invalid THEN system SHALL return 401 Unauthorized
4. WHEN user account is deleted THEN system SHALL return 404 Not Found
5. WHEN user object is returned THEN system SHALL include id, email, createdAt, updatedAt

### Requirement 6: JWT Authentication Guard

**User Story:** As a backend API, I want to protect routes with JwtAuthGuard, so that only authenticated users can access resources

#### Acceptance Criteria (EARS)

1. WHEN protected route is accessed without JWT THEN system SHALL return 401 Unauthorized
2. WHEN JWT is malformed THEN system SHALL return 401 Unauthorized with clear error message
3. WHEN JWT signature is invalid THEN system SHALL return 401 Unauthorized
4. WHEN JWT is expired THEN system SHALL return 401 Unauthorized with error code TOKEN_EXPIRED
5. WHEN JWT is valid THEN system SHALL attach user object to request context
6. WHEN guard validates JWT THEN system SHALL verify session exists in database (not deleted)

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: Separate AuthController (HTTP), AuthService (business logic), JwtStrategy (validation), guards
- **Modular Design**: NestJS module isolated in `apps/backend/src/auth/` with clear boundaries
- **Dependency Management**: Use NestJS DI for AuthService, PrismaService, JwtService, PassportModule
- **Clear Interfaces**: DTOs define login/register schemas, JwtPayload defines token structure
- **File Ownership**: This spec owns all files in `apps/backend/src/auth/**/*` (zero conflicts)

### Contract-Driven Development
- **Schema First**: Define Zod schemas in `@cc-task-manager/schemas/src/auth.schema.ts`
- **SSOT**: Zod schemas generate TypeScript types AND validate login/register requests
- **API Contract**: All endpoints match contract-client.ts expectations
- **Password Policy**: Defined in schema (min 8 chars, 1 uppercase, 1 number, 1 special char)

### Performance
- **Response Time**: < 200ms for login/logout (excluding bcrypt time ~100ms)
- **Bcrypt Work Factor**: 10 rounds (balance between security and performance)
- **Session Lookup**: Indexed by userId and refreshToken for fast validation
- **JWT Validation**: Stateless verification (no database lookup for guard, only signature check)

### Security
- **Password Hashing**: bcryptjs with 10 rounds, salted automatically
- **JWT Secret**: Stored in environment variable `AUTH_JWT_SECRET` (min 32 chars)
- **Token Expiration**: Access token 7 days, refresh token 30 days
- **Rate Limiting**: Apply aggressive rate limiter (5 login attempts per 15 min per IP)
- **No Password Leakage**: Never return password field in responses
- **Session Validation**: Guard checks database session exists (prevent token reuse after logout)
- **CSRF Protection**: Not required (stateless JWT, no cookies)

### Reliability
- **Error Handling**: Return proper HTTP status codes (200, 201, 400, 401, 409, 500)
- **Password Timing Attack Prevention**: Use bcrypt.compare() (constant-time comparison)
- **Database Constraints**: Unique constraint on User.email
- **Logging**: Log failed login attempts with IP address (security monitoring)

### Usability
- **Error Messages**: Clear messages for validation errors, generic for auth failures (security)
- **Consistent Format**: All responses follow standard ApiResponse<T> format
- **Documentation**: OpenAPI spec auto-generated from Zod schemas
- **Testing**: E2E tests in `apps/frontend/e2e/auth.spec.ts` validate all flows

### Environment-Driven Configuration
- **JWT Secret**: `AUTH_JWT_SECRET` (required, min 32 chars)
- **JWT Expiration**: `AUTH_JWT_EXPIRES_IN=7d`
- **Refresh Token Expiration**: `AUTH_REFRESH_EXPIRES_IN=30d`
- **Bcrypt Rounds**: `AUTH_BCRYPT_ROUNDS=10`
- **Feature Flag**: `AUTH_API_ENABLED=true`

## Success Criteria

- ✅ Users can register with email/password (no more "Cannot connect to server")
- ✅ Users can log in and receive JWT token
- ✅ Protected routes enforce authentication via JwtAuthGuard
- ✅ Settings page uses real userId from JWT (not 'current-user')
- ✅ WebSocket connections authenticate via JWT token
- ✅ Sessions persist across browser refreshes (refresh token flow)
- ✅ E2E tests validate complete auth flow

## Dependencies

**Blocked By**: None (foundational spec, can implement first)

**Blocks**:
- `backend-tasks-api` - Requires JwtAuthGuard for protected endpoints
- `backend-settings-api` - Requires userId from JWT context
- `backend-analytics-api` - Requires user authentication
- `task-creation-modal` - Frontend needs login before creating tasks

**Shared Files** (Append-only, no conflicts):
- `prisma/schema.prisma` - Add User, Session models
- `apps/frontend/src/lib/api/contract-client.ts` - Add auth methods (login, register, etc.)
- `apps/backend/src/main.ts` - Register AuthModule (one-line import)
