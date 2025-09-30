# Contract-First Development Requirements

## ⚠️ MANDATORY: All Implementations Must Follow Contract-Driven Development

This document defines the **mandatory contract-first workflow** that ALL specs must follow to maintain code quality and prevent integration issues.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│      packages/schemas/src/ (SSOT)          │
│   ┌─────────────────────────────────────┐   │
│   │ Zod Schemas (Single Source of Truth)│   │
│   │ • Type definitions                  │   │
│   │ • Validation rules                  │   │
│   │ • API contracts                     │   │
│   └─────────────────────────────────────┘   │
└──────────────┬──────────────────┬────────────┘
               │                  │
         1. Define Contract   2. Import & Use
               │                  │
               ▼                  ▼
       ┌──────────────┐   ┌──────────────┐
       │   Backend    │   │   Frontend   │
       │  (NestJS)    │   │  (Next.js)   │
       │   Imports    │   │   Imports    │
       │  @schemas/*  │   │ @cc-task..   │
       └──────────────┘   └──────────────┘
```

## Mandatory Workflow for ALL Specs

### Phase 1: Contract Definition (MUST BE FIRST)
**Before any implementation, define the contract:**

1. **Create schema file** in `packages/schemas/src/[domain]/`
   - Use Zod for schema definition
   - Include complete type definitions
   - Add validation rules
   - Document with JSDoc comments

2. **Export from schemas package**
   - Export from domain `index.ts`
   - Export from root `packages/schemas/src/index.ts`

3. **Build schemas package**
   ```bash
   cd packages/schemas && pnpm build
   ```

4. **Validate schema compiles**
   - No TypeScript errors
   - Zod schemas are valid
   - All exports accessible

### Phase 2: Backend Implementation
**Backend must import from shared schemas:**

```typescript
// ✅ CORRECT: Import from shared schemas
import { TaskSchema, TaskFilterSchema } from '@schemas/tasks';

// ❌ WRONG: Do NOT define schemas in backend
const TaskSchema = z.object({ ... }); // NO!
```

**Backend checklist:**
- [ ] Imports from `@schemas/*`
- [ ] Uses schemas for validation (NestJS pipes)
- [ ] Uses schemas for TypeScript types
- [ ] No duplicate schema definitions
- [ ] API endpoints use contract types

### Phase 3: Frontend Implementation
**Frontend must import from shared schemas:**

```typescript
// ✅ CORRECT: Import from shared schemas package
import { TaskSchema, type Task } from '@cc-task-manager/schemas';

// ❌ WRONG: Do NOT duplicate types
interface Task { ... } // NO!
```

**Frontend checklist:**
- [ ] Imports from `@cc-task-manager/schemas`
- [ ] Uses schema-derived TypeScript types
- [ ] Form validation uses schemas
- [ ] API calls use contract types
- [ ] No duplicate type definitions

### Phase 4: Validation & Testing
**Contract validation must be tested:**

1. **Schema validation tests**
   - Valid data passes
   - Invalid data rejected
   - Error messages are clear

2. **Integration tests**
   - Backend validates requests
   - Frontend sends correct format
   - Response matches contract

3. **Type safety tests**
   - TypeScript compilation passes
   - No type assertions needed
   - Autocomplete works

## Existing Contract Infrastructure

### 1. Schemas Package (`packages/schemas/`)
**Status:** ✅ Established for auth, needs extension for tasks/analytics/settings

**Current schemas:**
- `auth/auth.schemas.ts` - Authentication contracts
- Exports via `@cc-task-manager/schemas`

**What to add:**
- `tasks/task.schemas.ts` - Task contracts
- `analytics/analytics.schemas.ts` - Analytics contracts
- `settings/settings.schemas.ts` - Settings contracts

### 2. Contract Registry (`src/contracts/ContractRegistry.ts`)
**Status:** ✅ Exists, needs integration

**Purpose:** Centralized contract management with versioning

**Usage:**
```typescript
contractRegistry.registerContract('TaskCreate', TaskCreateSchema, '1.0.0');
const contract = contractRegistry.getContract('TaskCreate');
```

### 3. API Contract Generator (`src/contracts/ApiContractGenerator.ts`)
**Status:** ✅ Exists, needs integration

**Purpose:** Generate OpenAPI specs from Zod schemas

**Usage:**
```typescript
const openApiSpec = apiContractGenerator.generateOpenAPI(contracts);
```

## Task Requirements for Each Spec

### Task 0: Define API Contract (ALWAYS FIRST)
**This task MUST be completed BEFORE any backend or frontend work:**

```markdown
- [ ] 0. Define API contract in shared schemas package
  - File: packages/schemas/src/[domain]/[feature].schemas.ts
  - Define all Zod schemas for requests, responses, and data models
  - Export from domain index.ts and root index.ts
  - Build schemas package and verify compilation
  - Register contracts in ContractRegistry
  - Purpose: Establish single source of truth before implementation
  - _Leverage: packages/schemas/src/auth/auth.schemas.ts pattern_
  - _Requirements: ALL (contract is foundation)_
  - _Prompt: Role: API Architect with expertise in contract-driven development and Zod schemas | Task: Define complete API contract for [feature] in packages/schemas/src/[domain]/[feature].schemas.ts using Zod, following the auth.schemas.ts pattern, including all request/response schemas, validation rules, and JSDoc documentation | Restrictions: Must use Zod, follow existing schema patterns, include comprehensive validation, document all fields, ensure backward compatibility | Success: Schemas compile without errors, all types are exported, contracts are registered, both backend and frontend can import successfully_
```

### Example: Task Schema Definition

**File:** `packages/schemas/src/tasks/task.schemas.ts`

```typescript
import { z } from 'zod';

/**
 * Task status enum
 */
export const TaskStatus = z.enum(['pending', 'active', 'completed', 'failed']);
export type TaskStatus = z.infer<typeof TaskStatus>;

/**
 * Task priority enum
 */
export const TaskPriority = z.enum(['low', 'medium', 'high']);
export type TaskPriority = z.infer<typeof TaskPriority>;

/**
 * Base task schema
 */
export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: TaskStatus,
  priority: TaskPriority,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

/**
 * Task creation request schema
 */
export const TaskCreateSchema = TaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});
export type TaskCreate = z.infer<typeof TaskCreateSchema>;

/**
 * Task filter schema
 */
export const TaskFilterSchema = z.object({
  status: TaskStatus.or(z.array(TaskStatus)).optional(),
  priority: TaskPriority.or(z.array(TaskPriority)).optional(),
  searchTerm: z.string().optional(),
  dateRange: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }).optional(),
});
export type TaskFilter = z.infer<typeof TaskFilterSchema>;

/**
 * Task list response schema
 */
export const TaskListResponseSchema = z.object({
  tasks: z.array(TaskSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type TaskListResponse = z.infer<typeof TaskListResponseSchema>;
```

## Benefits of Contract-First Approach

### ✅ Type Safety
- Single source of truth prevents drift
- Compile-time errors catch mismatches
- Autocomplete in IDE

### ✅ Validation
- Runtime validation via Zod
- Consistent error messages
- Client and server validate same rules

### ✅ Documentation
- Self-documenting via schemas
- OpenAPI auto-generation
- Clear contract for all developers

### ✅ Testing
- Contract tests ensure compatibility
- Mock data from schemas
- Integration tests validate contracts

### ✅ Version Control
- Contract changes visible in git
- Breaking changes caught in PR
- Migration path clear

## Common Mistakes to Avoid

### ❌ Defining Types in Frontend
```typescript
// WRONG - Creates drift
interface Task {
  id: string;
  title: string;
  // Missing fields? Wrong types?
}
```

### ❌ Defining Schemas in Backend Only
```typescript
// WRONG - Frontend can't validate
const TaskSchema = z.object({ ... }); // Only in backend
```

### ❌ Skipping Contract Definition
```
// WRONG - Starting with implementation
1. Create TaskList component
2. Create API endpoint
// Problem: Contract is implicit, likely to drift
```

## Correct Workflow Example

```
✅ CORRECT ORDER:

1. Define contract in packages/schemas/
   └─> TaskSchema, TaskCreateSchema, TaskFilterSchema

2. Build schemas package
   └─> pnpm build in packages/schemas

3. Backend imports and implements
   └─> import { TaskSchema } from '@schemas/tasks'
   └─> Use in controllers, services, validation

4. Frontend imports and implements
   └─> import { TaskSchema } from '@cc-task-manager/schemas'
   └─> Use in components, API calls, forms

5. Both sides use same contract
   └─> No drift possible!
```

## Enforcement in Specs

All specs have been updated to include **Task 0: Define API Contract** as the mandatory first task. This ensures contract-first development is followed for every feature.

### Verification Checklist

Before merging any PR:
- [ ] Contract defined in `packages/schemas/`
- [ ] Backend imports from `@schemas/*`
- [ ] Frontend imports from `@cc-task-manager/schemas`
- [ ] No duplicate type definitions
- [ ] Contract tests pass
- [ ] OpenAPI documentation updated
- [ ] TypeScript compiles without errors
- [ ] Integration tests validate contract

## References

- **Contract-Driven Spec**: `.spec-workflow/specs/contract-driven/`
- **Implementation Guide**: `CONTRACT_DRIVEN_IMPLEMENTATION.md`
- **Schemas Package**: `packages/schemas/`
- **Contract Registry**: `src/contracts/ContractRegistry.ts`
- **API Contract Generator**: `src/contracts/ApiContractGenerator.ts`