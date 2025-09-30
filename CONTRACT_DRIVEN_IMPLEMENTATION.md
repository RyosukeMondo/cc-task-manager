# Contract-Driven Development Implementation

## Overview
This document describes the contract-driven development architecture implemented for the CC Task Manager application, ensuring type safety and API contract consistency between frontend and backend.

## Implementation Status: ✅ In Progress

### Completed ✅

1. **Shared Auth Schemas Package** (`/packages/schemas/src/auth/`)
   - Created centralized authentication schemas as single source of truth
   - Defined `UserRole` and `UserStatus` enums matching Prisma schema
   - All authentication contracts: `LoginRequestSchema`, `UserRegistrationSchema`, `AuthResponseSchema`, etc.
   - Exported from `@cc-task-manager/schemas`

2. **Backend Migration** (21 files updated)
   - All backend services now import from `@schemas/auth`
   - Updated files:
     - Auth service and controllers
     - WebSocket gateway and adapters
     - Task and user services
     - Guards and decorators
   - Path alias configured: `"@schemas/*": ["../../packages/schemas/src/*"]`

3. **Frontend Migration** (Partial)
   - Updated `/apps/frontend/src/lib/auth/types.ts` to import from `@cc-task-manager/schemas`
   - Updated `/apps/frontend/src/components/auth/RegisterForm.tsx` to extend `UserRegistrationSchema`
   - Path alias configured: `"@cc-task-manager/schemas": ["../../packages/schemas/src"]`

### Current Issues 🔧

1. **Frontend SSR Error**
   - `UserBaseSchema` appears undefined during Next.js server-side rendering
   - Error: `Cannot read properties of undefined (reading 'omit')`
   - Location: `/apps/frontend/src/lib/auth/types.ts:27`
   - Cause: Possible Next.js build cache or import resolution issue

2. **Pages Showing 404**
   - `/login` and `/register` pages returning 404
   - Likely due to SSR error preventing page render

### Architecture

```
┌─────────────────────────────────────────────┐
│         packages/schemas/src/auth/          │
│         auth.schemas.ts (SSOT)              │
│   ┌─────────────────────────────────────┐   │
│   │ • UserRole, UserStatus              │   │
│   │ • UserBaseSchema                    │   │
│   │ • LoginRequestSchema                │   │
│   │ • UserRegistrationSchema            │   │
│   │ • AuthResponseSchema                │   │
│   │ • JWTPayloadSchema                  │   │
│   └─────────────────────────────────────┘   │
└──────────────┬──────────────────┬────────────┘
               │                  │
         import via          import via
         @schemas/auth    @cc-task-manager/schemas
               │                  │
               ▼                  ▼
       ┌──────────────┐   ┌──────────────┐
       │   Backend    │   │   Frontend   │
       │  (NestJS)    │   │  (Next.js)   │
       └──────────────┘   └──────────────┘
```

### Benefits

✅ **Single Source of Truth** - One schema definition shared across stack
✅ **Type Safety** - TypeScript catches mismatches at compile time
✅ **Contract Enforcement** - Zod validates at runtime
✅ **Auto-Propagation** - Schema changes automatically flow to both apps
✅ **Build-Time Validation** - Incompatible changes break builds, not production

### Example: How the `email` vs `identifier` Bug is Now Prevented

**Before Contract-Driven** (caused 422 error):
```typescript
// Frontend sent:
{ email: "user@example.com", password: "..." }

// Backend expected:
{ identifier: "user@example.com", password: "..." }
// Result: 422 validation error at runtime ❌
```

**After Contract-Driven**:
```typescript
// packages/schemas/src/auth/auth.schemas.ts
export const LoginRequestSchema = z.object({
  identifier: z.string(),  // ← SSOT
  password: z.string(),
});

// Backend imports from @schemas/auth
import { LoginRequestSchema } from '@schemas/auth';

// Frontend imports from @cc-task-manager/schemas
import { LoginRequestSchema } from '@cc-task-manager/schemas';

// Both use same schema ✅
// Mismatch = TypeScript error at build time ✅
```

## Next Steps

### Immediate (To fix current issues):

1. **Resolve Frontend SSR Error**
   - Debug `UserBaseSchema` import in Next.js SSR context
   - Ensure `@cc-task-manager/schemas` resolves correctly in both client and server bundles
   - Consider dynamic import or client-only component if needed

2. **Verify Auth Flow**
   - Test registration with shared schemas
   - Test login with shared schemas
   - Ensure `identifier` field mapping works correctly

### Longer Term:

3. **OpenAPI Documentation**
   - Create `OpenApiDocumentationService` to generate spec from `ContractRegistry`
   - Build `OpenApiController` with Swagger UI endpoint
   - Add spec generation endpoint at `/api/docs`

4. **Type Generation**
   - Automatic frontend type generation from OpenAPI spec
   - Pre-commit hooks to regenerate types on schema changes

5. **Testing**
   - Fix Jest configuration errors
   - Add E2E contract validation tests
   - Test suite to verify API responses match schemas

6. **Pre-Commit Validation**
   - Hook to validate all API contracts before commit
   - Prevent breaking changes from being committed

## File Structure

```
cc-task-manager/
├── packages/
│   └── schemas/
│       ├── src/
│       │   ├── auth/
│       │   │   ├── auth.schemas.ts    ← SSOT for auth
│       │   │   └── index.ts
│       │   └── index.ts               ← Re-exports all schemas
│       ├── dist/                      ← Compiled JS + .d.ts
│       └── package.json
│
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts  → imports @schemas/auth
│   │   │   │   ├── auth.service.ts     → imports @schemas/auth
│   │   │   │   └── ...
│   │   │   └── schemas/
│   │   │       └── auth.schemas.ts     ← DEPRECATED (use @schemas/auth)
│   │   └── tsconfig.json
│   │        └── paths: {"@schemas/*": ["../../packages/schemas/src/*"]}
│   │
│   └── frontend/
│       ├── src/
│       │   ├── lib/
│       │   │   └── auth/
│       │   │       ├── types.ts         → imports @cc-task-manager/schemas
│       │   │       └── context.tsx
│       │   └── components/
│       │       └── auth/
│       │           └── RegisterForm.tsx → imports @cc-task-manager/schemas
│       └── tsconfig.json
│            └── references: [{ "path": "../../packages/schemas" }]
```

## Troubleshooting

### Issue: `Cannot find module '@cc-task-manager/schemas'`
**Solution**: Run `pnpm build` in `/packages/schemas` to compile TypeScript

### Issue: Frontend shows stale types after schema changes
**Solution**:
1. Rebuild schemas: `cd packages/schemas && pnpm build`
2. Clear Next.js cache: `rm -rf apps/frontend/.next`
3. Restart frontend dev server

### Issue: Backend can't import from `@schemas/auth`
**Solution**: Check `tsconfig.json` has correct path mapping:
```json
{
  "paths": {
    "@schemas/*": ["../../packages/schemas/src/*"]
  }
}
```

## References

- **Schemas Package**: `/packages/schemas/`
- **Backend Auth Implementation**: `/apps/backend/src/auth/`
- **Frontend Auth Implementation**: `/apps/frontend/src/lib/auth/`
- **Contract Registry** (existing): `/src/contracts/ContractRegistry.ts`
- **API Contract Generator** (existing): `/src/contracts/ApiContractGenerator.ts`