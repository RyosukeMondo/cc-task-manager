# Design Document - Backend Settings API

## Architecture Overview

The Backend Settings API provides user preferences management with auto-creation of defaults:

```
Controller (HTTP) → Service (Upsert Logic) → Repository (Prisma) → Database
```

### Module Structure

```typescript
SettingsModule
├── SettingsController (HTTP endpoints)
├── SettingsService (Auto-create + update logic)
├── SettingsRepository (Database operations)
└── DTOs
    ├── UpdateSettingsDto
    └── SettingsResponseDto
```

## Data Model

### Prisma Schema

```prisma
model Settings {
  id              String   @id @default(uuid())
  userId          String   @unique @db.VarChar(36)

  // User preferences
  theme           Theme    @default(SYSTEM)
  notifications   Boolean  @default(true)
  displayDensity  DisplayDensity @default(COMFORTABLE)
  language        String   @default("en") @db.VarChar(10)

  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("settings")
}

enum Theme {
  LIGHT
  DARK
  SYSTEM
}

enum DisplayDensity {
  COMFORTABLE
  COMPACT
  SPACIOUS
}
```

### Migration Strategy

```bash
# Migration file: 20251001_backend_settings_api_create_settings.sql
# Run: npx prisma migrate dev --name create_settings
```

## API Endpoints

### 1. Get User Settings

```typescript
GET /api/settings
Authorization: Bearer <jwt>

Response (200 OK):
{
  "id": "uuid",
  "userId": "user-uuid",
  "theme": "SYSTEM",
  "notifications": true,
  "displayDensity": "COMFORTABLE",
  "language": "en",
  "createdAt": "2025-10-01T12:00:00Z",
  "updatedAt": "2025-10-01T12:00:00Z"
}

// NOTE: If settings don't exist, they are auto-created with defaults

Errors:
- 401 Unauthorized: No JWT or invalid token
```

### 2. Update User Settings

```typescript
PATCH /api/settings
Authorization: Bearer <jwt>

Request Body (partial updates):
{
  "theme"?: "LIGHT" | "DARK" | "SYSTEM",
  "notifications"?: boolean,
  "displayDensity"?: "COMFORTABLE" | "COMPACT" | "SPACIOUS",
  "language"?: string (ISO 639-1 code)
}

Response (200 OK):
{
  /* updated settings object */
}

Errors:
- 400 Bad Request: Invalid enum value
- 401 Unauthorized: No JWT
```

## Component Design

### SettingsController

```typescript
@Controller('api/settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(@User() user): Promise<Settings> {
    return this.settingsService.getOrCreateSettings(user.id);
  }

  @Patch()
  async updateSettings(
    @Body() dto: UpdateSettingsDto,
    @User() user
  ): Promise<Settings> {
    return this.settingsService.updateSettings(user.id, dto);
  }
}
```

### SettingsService

```typescript
@Injectable()
export class SettingsService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly logger: Logger
  ) {}

  async getOrCreateSettings(userId: string): Promise<Settings> {
    // Try to find existing settings
    let settings = await this.settingsRepository.findByUserId(userId);

    // Auto-create if not found (zero-configuration)
    if (!settings) {
      settings = await this.settingsRepository.create({
        userId,
        theme: Theme.SYSTEM,
        notifications: true,
        displayDensity: DisplayDensity.COMFORTABLE,
        language: process.env.SETTINGS_DEFAULT_LANGUAGE || 'en'
      });

      this.logger.log(`Auto-created default settings for user: ${userId}`);
    }

    return settings;
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<Settings> {
    // Use upsert to handle both create and update
    const updated = await this.settingsRepository.upsert({
      where: { userId },
      update: dto,
      create: {
        userId,
        ...this.getDefaults(),
        ...dto // Override defaults with provided values
      }
    });

    this.logger.log(`Settings updated for user: ${userId}`);
    return updated;
  }

  private getDefaults(): Partial<Settings> {
    return {
      theme: Theme.SYSTEM,
      notifications: true,
      displayDensity: DisplayDensity.COMFORTABLE,
      language: process.env.SETTINGS_DEFAULT_LANGUAGE || 'en'
    };
  }
}
```

### SettingsRepository

```typescript
@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<Settings | null> {
    return this.prisma.settings.findUnique({
      where: { userId }
    });
  }

  async create(data: CreateSettingsData): Promise<Settings> {
    return this.prisma.settings.create({ data });
  }

  async update(userId: string, data: UpdateSettingsData): Promise<Settings> {
    return this.prisma.settings.update({
      where: { userId },
      data
    });
  }

  async upsert(params: {
    where: { userId: string };
    update: UpdateSettingsData;
    create: CreateSettingsData;
  }): Promise<Settings> {
    return this.prisma.settings.upsert(params);
  }
}
```

## DTOs and Validation

### UpdateSettingsDto

```typescript
// packages/schemas/src/settings.schema.ts
import { z } from 'zod';

export const updateSettingsSchema = z.object({
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  notifications: z.boolean().optional(),
  displayDensity: z.enum(['COMFORTABLE', 'COMPACT', 'SPACIOUS']).optional(),
  language: z
    .string()
    .length(2)
    .regex(/^[a-z]{2}$/, 'Invalid ISO 639-1 language code')
    .optional()
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
```

### SettingsResponseDto

```typescript
export const settingsResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
  notifications: z.boolean(),
  displayDensity: z.enum(['COMFORTABLE', 'COMPACT', 'SPACIOUS']),
  language: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type SettingsResponseDto = z.infer<typeof settingsResponseSchema>;
```

## File Structure

```
apps/backend/src/settings/
├── settings.module.ts             # Module definition
├── settings.controller.ts         # HTTP endpoints
├── settings.service.ts            # Upsert logic + defaults
├── settings.repository.ts         # Database operations
└── dto/
    ├── update-settings.dto.ts     # Import from schemas package
    └── settings-response.dto.ts   # Import from schemas package

packages/schemas/src/
├── settings.schema.ts             # Zod schemas (SSOT)
└── index.ts                       # Export schemas

apps/frontend/src/lib/api/
└── contract-client.ts             # Add settings methods
```

## Frontend Integration

```typescript
// apps/frontend/src/lib/api/contract-client.ts

// ========== Spec: backend-settings-api ==========
export class ApiClient {
  async getSettings(): Promise<Settings> {
    return this.http.get('/api/settings');
  }

  async updateSettings(data: UpdateSettingsDto): Promise<Settings> {
    return this.http.patch('/api/settings', data);
  }
}
```

## Auto-Create Strategy

### Why Auto-Create?

- **Zero Configuration**: New users don't need to set up preferences
- **No 404 Errors**: Frontend always gets settings (simplifies error handling)
- **Better UX**: Users see sensible defaults immediately

### Race Condition Handling

```typescript
// Using Prisma upsert prevents race conditions
async getOrCreateSettings(userId: string): Promise<Settings> {
  // Option 1: Try-find then create (possible race condition)
  // ❌ Don't do this - two concurrent requests could both try to create

  // Option 2: Use upsert (atomic operation)
  // ✅ Safe for concurrent requests
  return this.prisma.settings.upsert({
    where: { userId },
    update: {}, // No updates, just return existing
    create: {
      userId,
      ...this.getDefaults()
    }
  });
}
```

## Default Values Configuration

### Environment-Driven Defaults

```bash
# .env
SETTINGS_DEFAULT_THEME=SYSTEM
SETTINGS_DEFAULT_LANGUAGE=en
SETTINGS_DEFAULT_NOTIFICATIONS=true
SETTINGS_DEFAULT_DENSITY=COMFORTABLE
```

### Service Implementation

```typescript
private getDefaults(): Partial<Settings> {
  return {
    theme: (process.env.SETTINGS_DEFAULT_THEME as Theme) || Theme.SYSTEM,
    notifications: process.env.SETTINGS_DEFAULT_NOTIFICATIONS === 'true',
    displayDensity: (process.env.SETTINGS_DEFAULT_DENSITY as DisplayDensity) || DisplayDensity.COMFORTABLE,
    language: process.env.SETTINGS_DEFAULT_LANGUAGE || 'en'
  };
}
```

## Validation Details

### Theme Validation

```typescript
// Only allow these exact values
theme: z.enum(['LIGHT', 'DARK', 'SYSTEM'])

// Prisma enforces at DB level via enum
enum Theme {
  LIGHT
  DARK
  SYSTEM
}
```

### Language Validation

```typescript
// ISO 639-1 language codes (2-letter lowercase)
language: z
  .string()
  .length(2)
  .regex(/^[a-z]{2}$/)
  .optional()

// Examples: en, es, fr, de, ja, zh
```

### Display Density Validation

```typescript
displayDensity: z.enum(['COMFORTABLE', 'COMPACT', 'SPACIOUS'])

// Frontend uses these to adjust spacing/padding
```

## Error Handling

```typescript
// Custom validation error messages
try {
  const validated = updateSettingsSchema.parse(dto);
} catch (error) {
  if (error instanceof ZodError) {
    throw new BadRequestException({
      message: 'Invalid settings data',
      errors: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        allowedValues: e.code === 'invalid_enum_value' ? e.options : undefined
      }))
    });
  }
}

// Example error response:
{
  "statusCode": 400,
  "message": "Invalid settings data",
  "errors": [
    {
      "field": "theme",
      "message": "Invalid enum value",
      "allowedValues": ["LIGHT", "DARK", "SYSTEM"]
    }
  ]
}
```

## Testing Strategy

```typescript
// apps/frontend/e2e/settings-api.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Settings API E2E', () => {
  test('should auto-create settings on first GET', async ({ request }) => {
    // Login as new user
    const loginResponse = await request.post('/api/auth/login', {
      data: { email: 'newuser@example.com', password: 'Password123!' }
    });
    const { accessToken } = await loginResponse.json();

    // GET settings (should auto-create)
    const response = await request.get('/api/settings', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    expect(response.status()).toBe(200);
    const settings = await response.json();
    expect(settings.theme).toBe('SYSTEM');
    expect(settings.notifications).toBe(true);
  });

  test('should update settings via PATCH', async ({ request }) => {
    const response = await request.patch('/api/settings', {
      data: { theme: 'DARK', displayDensity: 'COMPACT' }
    });

    expect(response.status()).toBe(200);
    const updated = await response.json();
    expect(updated.theme).toBe('DARK');
    expect(updated.displayDensity).toBe('COMPACT');
  });

  test('should reject invalid theme value', async ({ request }) => {
    const response = await request.patch('/api/settings', {
      data: { theme: 'INVALID' }
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.errors[0].allowedValues).toEqual(['LIGHT', 'DARK', 'SYSTEM']);
  });

  test('should persist settings across sessions', async ({ request }) => {
    // Update settings
    await request.patch('/api/settings', {
      data: { theme: 'DARK' }
    });

    // Logout and login again
    await request.post('/api/auth/logout');
    const loginResponse = await request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'Password123!' }
    });
    const { accessToken } = await loginResponse.json();

    // GET settings (should persist)
    const response = await request.get('/api/settings', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const settings = await response.json();
    expect(settings.theme).toBe('DARK'); // Still dark theme
  });
});
```

## Performance Optimizations

1. **Database Index**: Unique index on userId for fast lookups
2. **Upsert**: Atomic operation prevents race conditions
3. **Cascade Delete**: When user is deleted, settings are auto-deleted (no orphans)
4. **No Caching**: Settings change infrequently, always fetch fresh from DB

## Security Considerations

1. **Authorization**: Users can ONLY access their own settings (userId from JWT)
2. **No User Enumeration**: Never return 404 (auto-create instead)
3. **Input Validation**: Zod enforces enum values (prevent invalid DB state)
4. **SQL Injection Prevention**: Prisma parameterizes all queries

## Migration Path

1. Create Prisma migration for Settings model
2. Implement SettingsModule
3. Add to backend main.ts
4. Update frontend contract-client.ts
5. Update Settings page to use real API (remove 'current-user' hardcode)
6. Run E2E tests
7. Deploy to staging

## Environment Variables

```bash
# .env
SETTINGS_API_ENABLED=true
SETTINGS_DEFAULT_THEME=SYSTEM
SETTINGS_DEFAULT_LANGUAGE=en
SETTINGS_DEFAULT_NOTIFICATIONS=true
SETTINGS_DEFAULT_DENSITY=COMFORTABLE
```

## Integration with Frontend

### Settings Page Hook

```typescript
// apps/frontend/src/hooks/useSettings.ts
import { useQuery, useMutation } from '@tanstack/react-query';

export function useSettings() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings()
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateSettingsDto) => apiClient.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    }
  });

  return {
    settings,
    isLoading,
    updateSettings: updateMutation.mutate
  };
}
```

### Settings Page Component

```typescript
// apps/frontend/src/app/settings/page.tsx
export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();

  const handleThemeChange = (theme: Theme) => {
    updateSettings({ theme });
  };

  return (
    <div>
      <h1>Settings</h1>
      <Select value={settings?.theme} onChange={handleThemeChange}>
        <option value="LIGHT">Light</option>
        <option value="DARK">Dark</option>
        <option value="SYSTEM">System</option>
      </Select>
    </div>
  );
}
```

This design ensures settings work seamlessly with zero configuration required from users!
