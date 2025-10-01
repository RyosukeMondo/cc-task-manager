# Design Document - Backend Auth API

## Architecture Overview

The Backend Auth API implements JWT-based authentication using Passport.js:

```
Controller (HTTP) → Service (Auth Logic) → Repository (User CRUD) → Database
                        ↓
                  JWT Strategy (Token Validation)
                        ↓
                  Guards (Route Protection)
```

### Module Structure

```typescript
AuthModule
├── AuthController (HTTP endpoints)
├── AuthService (Login, register, token management)
├── JwtStrategy (Token validation logic)
├── JwtAuthGuard (Route protection)
├── WsJwtGuard (WebSocket authentication)
└── DTOs
    ├── RegisterDto
    ├── LoginDto
    └── AuthResponseDto
```

## Data Models

### Prisma Schema

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique @db.VarChar(255)
  password      String   @db.VarChar(255) // Bcrypt hash
  name          String?  @db.VarChar(100)

  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime? // Soft delete

  // Relations
  sessions      Session[]
  tasks         Task[]
  settings      Settings?

  @@index([email])
  @@map("users")
}

model Session {
  id            String   @id @default(uuid())
  userId        String   @db.VarChar(36)
  refreshToken  String   @unique @db.VarChar(512)
  expiresAt     DateTime
  lastActive    DateTime @default(now())

  // Timestamps
  createdAt     DateTime @default(now())
  deletedAt     DateTime? // Logout = soft delete

  // Relations
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([refreshToken])
  @@map("sessions")
}
```

### Migration Strategy

```bash
# Migration file: 20251001_backend_auth_api_create_users_sessions.sql
# Run: npx prisma migrate dev --name create_users_sessions
```

## API Endpoints

### 1. Register

```typescript
POST /api/auth/register

Request Body:
{
  "email": string (required, valid email),
  "password": string (required, min 8 chars, 1 upper, 1 number, 1 special),
  "name"?: string (optional, max 100 chars)
}

Response (201 Created):
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-10-01T12:00:00Z"
  }
}
// NOTE: No JWT returned, user must explicitly login

Errors:
- 400 Bad Request: Invalid input
- 409 Conflict: Email already exists
- 422 Unprocessable Entity: Password too weak
```

### 2. Login

```typescript
POST /api/auth/login

Request Body:
{
  "email": string,
  "password": string
}

Response (200 OK):
{
  "accessToken": "eyJhbGciOiJIUzI1...",  // JWT, expires in 7 days
  "refreshToken": "random-uuid-token",    // For token refresh
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}

Errors:
- 400 Bad Request: Missing email/password
- 401 Unauthorized: Invalid credentials
```

### 3. Refresh Token

```typescript
POST /api/auth/refresh

Request Body:
{
  "refreshToken": string
}

Response (200 OK):
{
  "accessToken": "new-jwt-token",
  "refreshToken": "same-or-new-refresh-token"
}

Errors:
- 401 Unauthorized: Invalid/expired refresh token
```

### 4. Logout

```typescript
POST /api/auth/logout
Authorization: Bearer <jwt>

Response (204 No Content)

Errors:
- 401 Unauthorized: Invalid JWT
```

### 5. Get Current User

```typescript
GET /api/auth/me
Authorization: Bearer <jwt>

Response (200 OK):
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2025-10-01T12:00:00Z"
}

Errors:
- 401 Unauthorized: Invalid JWT
- 404 Not Found: User deleted
```

## Component Design

### AuthController

```typescript
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<{ user: User }> {
    const user = await this.authService.register(dto);
    return { user };
  }

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async logout(@User() user): Promise<void> {
    return this.authService.logout(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@User() user): Promise<User> {
    return this.authService.findUserById(user.id);
  }
}
```

### AuthService

```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly logger: Logger
  ) {}

  async register(dto: RegisterDto): Promise<User> {
    // Check if email exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password with bcrypt (10 rounds)
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true
        // Exclude password
      }
    });

    this.logger.log(`User registered: ${user.email}`);
    return user;
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.AUTH_JWT_EXPIRES_IN || '7d'
    });

    const refreshToken = randomBytes(64).toString('hex');

    // Create session
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });

    this.logger.log(`User logged in: ${user.email}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    // Find session
    const session = await this.prisma.session.findUnique({
      where: { refreshToken, deletedAt: null },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Generate new access token
    const payload: JwtPayload = {
      sub: session.user.id,
      email: session.user.email,
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.AUTH_JWT_EXPIRES_IN || '7d'
    });

    // Update session last active
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActive: new Date() }
    });

    return {
      accessToken,
      refreshToken, // Return same refresh token
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name
      }
    };
  }

  async logout(userId: string): Promise<void> {
    // Soft-delete all active sessions for user
    await this.prisma.session.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    this.logger.log(`User logged out: ${userId}`);
  }

  async findUserById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
```

### JWT Strategy

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.AUTH_JWT_SECRET,
      ignoreExpiration: false
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // Verify user exists and is not deleted
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    if (!user) {
      throw new UnauthorizedException('User not found or deleted');
    }

    // Verify session exists (not logged out)
    const activeSession = await this.prisma.session.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!activeSession) {
      throw new UnauthorizedException('Session expired or logged out');
    }

    return user; // This gets attached to request.user
  }
}
```

### JwtAuthGuard

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expired');
      }
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
```

### WebSocket JWT Guard

```typescript
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new WsException('Unauthorized');
    }

    try {
      const payload = this.jwtService.verify(token);
      client.data.user = payload; // Attach to socket
      return true;
    } catch (e) {
      throw new WsException('Invalid token');
    }
  }
}
```

## DTOs and Validation

### RegisterDto

```typescript
// packages/schemas/src/auth.schema.ts
import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  name: z.string().max(100).optional()
});

export type RegisterDto = z.infer<typeof registerSchema>;
```

### LoginDto

```typescript
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type LoginDto = z.infer<typeof loginSchema>;
```

### JwtPayload

```typescript
export interface JwtPayload {
  sub: string;      // userId
  email: string;
  iat: number;      // Issued at
  exp?: number;     // Expiration (set by JwtService)
}
```

## File Structure

```
apps/backend/src/auth/
├── auth.module.ts                # Module with Passport + JWT
├── auth.controller.ts            # HTTP endpoints
├── auth.service.ts               # Login, register, token logic
├── strategies/
│   └── jwt.strategy.ts           # JWT validation
├── guards/
│   ├── jwt-auth.guard.ts         # HTTP route protection
│   └── ws-jwt.guard.ts           # WebSocket authentication
└── dto/
    ├── register.dto.ts           # Import from schemas
    ├── login.dto.ts              # Import from schemas
    └── auth-response.dto.ts      # Token response type

packages/schemas/src/
├── auth.schema.ts                # Zod schemas (SSOT)
└── index.ts                      # Export schemas

apps/frontend/src/lib/api/
└── contract-client.ts            # Add auth methods
```

## Frontend Integration

```typescript
// apps/frontend/src/lib/api/contract-client.ts

// ========== Spec: backend-auth-api ==========
export class ApiClient {
  async register(data: RegisterDto): Promise<{ user: User }> {
    return this.http.post('/api/auth/register', data);
  }

  async login(credentials: LoginDto): Promise<AuthResponseDto> {
    const response = await this.http.post('/api/auth/login', credentials);

    // Store tokens
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);

    return response;
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    const response = await this.http.post('/api/auth/refresh', { refreshToken });

    // Update stored token
    localStorage.setItem('accessToken', response.accessToken);

    return response;
  }

  async logout(): Promise<void> {
    await this.http.post('/api/auth/logout');

    // Clear stored tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async getCurrentUser(): Promise<User> {
    return this.http.get('/api/auth/me');
  }

  // HTTP interceptor to add JWT to requests
  private addAuthHeader(config: RequestConfig): RequestConfig {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`
      };
    }
    return config;
  }
}
```

## Security Considerations

1. **Password Hashing**: Bcrypt with 10 rounds (balance security/performance)
2. **JWT Secret**: Min 32 chars, stored in environment variable
3. **Token Expiration**: Access token 7 days, refresh token 30 days
4. **Rate Limiting**: 5 login attempts per 15 min per IP
5. **Session Validation**: Guard checks database session exists (prevents reuse after logout)
6. **No Password Leakage**: Never return password in responses (Prisma select excludes it)
7. **Timing Attack Prevention**: bcrypt.compare uses constant-time comparison

## Performance Optimizations

1. **Database Indexes**: Index on (userId), (refreshToken), (email)
2. **Session Lookup**: Fast UUID index for refresh token validation
3. **JWT Stateless**: No database lookup for guard (only signature verification)
4. **Bcrypt Rounds**: 10 rounds = ~100ms (acceptable for login, doesn't block queue)

## Testing Strategy

```typescript
// apps/frontend/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Auth API E2E', () => {
  test('should register new user', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: {
        email: `test-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Test User'
      }
    });

    expect(response.status()).toBe(201);
    const { user } = await response.json();
    expect(user.email).toContain('test-');
  });

  test('should login and receive JWT', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'Password123!' }
    });

    expect(response.status()).toBe(200);
    const { accessToken, refreshToken, user } = await response.json();
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  test('should reject weak password', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: { email: 'weak@example.com', password: '12345' }
    });

    expect(response.status()).toBe(400);
  });

  test('should logout and invalidate session', async ({ request }) => {
    // Login first
    const loginResponse = await request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'Password123!' }
    });
    const { accessToken } = await loginResponse.json();

    // Logout
    const logoutResponse = await request.post('/api/auth/logout', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    expect(logoutResponse.status()).toBe(204);

    // Try to use same token (should fail)
    const meResponse = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    expect(meResponse.status()).toBe(401);
  });
});
```

## Environment Variables

```bash
# .env
AUTH_API_ENABLED=true
AUTH_JWT_SECRET=your-very-long-secret-key-min-32-chars
AUTH_JWT_EXPIRES_IN=7d
AUTH_REFRESH_EXPIRES_IN=30d
AUTH_BCRYPT_ROUNDS=10
```

## Migration Path

1. Create Prisma migration for User and Session models
2. Implement AuthModule with Passport + JWT
3. Add JwtAuthGuard to protected routes (Tasks, Settings, Analytics)
4. Update frontend contract-client with auth methods
5. Implement login page UI
6. Run E2E tests
7. Deploy to staging with proper JWT secret
