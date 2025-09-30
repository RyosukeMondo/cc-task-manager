# Tasks Document - Settings Page

## ⚠️ MANDATORY: Contract-First Development
Task 0 MUST be completed before any other tasks. All settings functionality depends on shared API contracts.

- [ ] 0. Define Settings API contract in shared schemas package
  - File: packages/schemas/src/settings/settings.schemas.ts
  - Define all Zod schemas: SettingsSchema, UserProfileSchema, AppPreferencesSchema, NotificationSettingsSchema, ThemeSchema, LanguageSchema
  - Export from packages/schemas/src/settings/index.ts and packages/schemas/src/index.ts
  - Build schemas package (cd packages/schemas && pnpm build)
  - Register contracts in ContractRegistry
  - Purpose: Establish single source of truth for settings data contracts before any implementation
  - _Leverage: packages/schemas/src/auth/auth.schemas.ts pattern, existing ContractRegistry_
  - _Requirements: 1.1, 2.1, 3.1, 3.3, 3.4_
  - _Prompt: Role: API Architect with expertise in user settings, contract-driven development, Zod schemas, and TypeScript | Task: Define complete Settings API contract in packages/schemas/src/settings/settings.schemas.ts following the auth.schemas.ts pattern, including SettingsSchema (composite of all settings with userId, timestamps), UserProfileSchema (name, email, avatar, bio with string validations), AppPreferencesSchema (theme enum (light/dark/system), language, dateFormat, timeFormat, defaultView), NotificationSettingsSchema (emailNotifications, pushNotifications, taskReminders, dailyDigest as booleans), ThemeSchema enum (light, dark, system), LanguageSchema enum (en, es, fr, de, etc.) with full Zod validation rules including email format, string min/max lengths, URL validation for avatars, enum constraints, and comprehensive JSDoc documentation for all fields explaining purposes and valid values | Restrictions: Must use Zod for all schemas, follow existing schema patterns from auth, include comprehensive validation (email format validation, name length limits, bio character limits, valid theme/language options), document all fields with JSDoc explaining behavior and constraints, ensure schemas compile without errors, export all types and schemas properly from settings/index.ts and main index.ts, register contracts in ContractRegistry with versioning (v1.0.0), include both individual setting schemas and composite SettingsSchema | Success: Settings schemas defined and compiled successfully, all exports accessible from @cc-task-manager/schemas and @schemas/settings, contracts registered in registry with proper versioning, both backend and frontend can import without errors, validation rules are comprehensive covering all setting types, TypeScript types auto-generated from schemas, JSDoc documentation explains all settings and their constraints, schemas support both individual settings updates and bulk operations_

- [ ] 1. Import settings types from shared schemas instead of defining locally
  - File: apps/frontend/src/types/settings.ts
  - Import settings types from @cc-task-manager/schemas instead of defining locally
  - Re-export for convenience: export type { Settings, UserProfile, AppPreferences, NotificationSettings, Theme, Language } from '@cc-task-manager/schemas'
  - Purpose: Use shared contract types to ensure frontend-backend consistency for settings data
  - _Leverage: packages/schemas/src/settings/settings.schemas.ts (from Task 0)_
  - _Requirements: 1.1, 2.1, 3.1, 3.3_
  - _Prompt: Role: TypeScript Developer specializing in type systems and contract-driven development | Task: Create type re-export file at apps/frontend/src/types/settings.ts that imports and re-exports Settings, UserProfile, AppPreferences, NotificationSettings, Theme, Language, and other settings-related types from @cc-task-manager/schemas following requirements 1.1, 2.1, 3.1, and 3.3 | Restrictions: Must import from @cc-task-manager/schemas only, do not define any types locally, only re-export for convenience, ensure tsconfig.json references schemas package, verify types are accessible, do not duplicate settings type definitions | Success: All settings types imported from shared schemas, re-exported for frontend use, TypeScript compiles without errors, no duplicate type definitions, frontend has full type coverage from shared contracts for all settings including user profile, preferences, and notifications_

- [ ] 2. Create useSettings hook
  - File: apps/frontend/src/hooks/useSettings.ts
  - Implement hook for settings state management and persistence
  - Purpose: Centralize settings data management
  - _Leverage: Existing API client patterns, local storage utilities_
  - _Requirements: 1.3, 1.4, 3.4_
  - _Prompt: Role: React Developer | Task: Implement useSettings custom hook following requirements 1.3, 1.4, and 3.4, managing settings state with API and local storage | Restrictions: Handle loading and error states, implement optimistic updates, debounce auto-save | Success: Hook provides settings data with CRUD operations, proper state management, and persistence_

- [ ] 3. Create ProfileSettings component
  - File: apps/frontend/src/components/settings/ProfileSettings.tsx
  - Implement user profile settings form with validation
  - Purpose: Allow users to update profile information
  - _Leverage: React Hook Form, Zod, form components from shadcn/ui_
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - _Prompt: Role: Frontend Developer | Task: Create ProfileSettings form component following requirements 2.1-2.4, using React Hook Form with Zod validation | Restrictions: Must validate all inputs, handle errors gracefully, provide clear feedback, ensure accessibility | Success: Profile form works correctly, validates inputs, saves changes, provides clear error messages_

- [ ] 4. Create PreferencesSettings component
  - File: apps/frontend/src/components/settings/PreferencesSettings.tsx
  - Implement application preferences form with theme toggle
  - Purpose: Allow users to customize application behavior
  - _Leverage: Theme context, Switch and Select components_
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Prompt: Role: Frontend Developer | Task: Create PreferencesSettings component following requirements 3.1-3.4, integrating with theme context for live theme switching | Restrictions: Must apply theme changes immediately, persist preferences, maintain accessibility | Success: Preferences component works, theme switching is immediate, settings persist correctly_

- [ ] 5. Create NotificationSettings component
  - File: apps/frontend/src/components/settings/NotificationSettings.tsx
  - Implement notification preferences form
  - Purpose: Allow users to configure notification preferences
  - _Leverage: Switch components, form patterns_
  - _Requirements: 3.3, 3.4_
  - _Prompt: Role: Frontend Developer | Task: Create NotificationSettings component for managing notification preferences following requirements 3.3 and 3.4 | Restrictions: Must save changes automatically or with explicit save, provide feedback, ensure accessibility | Success: Notification settings work correctly, save properly, provide clear feedback_

- [ ] 6. Create settings page layout
  - File: apps/frontend/src/app/settings/page.tsx
  - Create page with tabs/sections for different settings categories
  - Purpose: Establish /settings route with organized layout
  - _Leverage: Tabs component, Card component, settings section components_
  - _Requirements: 1.1, 1.2, 4.1_
  - _Prompt: Role: Next.js Developer | Task: Create settings page at apps/frontend/src/app/settings/page.tsx following requirements 1.1, 1.2, and 4.1, organizing settings into tabs/sections | Restrictions: Must set proper metadata, handle loading states, follow page structure patterns | Success: Page exists with organized settings layout, loads without 404, all sections accessible_

- [ ] 7. Uncomment Settings navigation in Sidebar
  - File: apps/frontend/src/components/layout/Sidebar.tsx
  - Uncomment the System section with Settings link (lines 109-119)
  - Purpose: Enable navigation to settings page
  - _Leverage: Existing navigation structure_
  - _Requirements: 4.1, 4.2, 4.3_
  - _Prompt: Role: Frontend Developer | Task: Uncomment the System section in Sidebar.tsx (lines 109-119) to enable settings navigation following requirements 4.1-4.3 | Restrictions: Ensure no syntax errors, verify active state highlighting | Success: System section visible, Settings link navigates to /settings without 404, active state works_

- [ ] 8. Uncomment Settings navigation in Navigation
  - File: apps/frontend/src/components/layout/Navigation.tsx
  - Uncomment the Settings navigation item (lines 58-63)
  - Purpose: Enable settings link in top navigation
  - _Leverage: Existing navigation structure_
  - _Requirements: 4.1, 4.2, 4.3_
  - _Prompt: Role: Frontend Developer | Task: Uncomment the Settings navigation item in Navigation.tsx (lines 58-63) following requirements 4.1-4.3 | Restrictions: Ensure mobile navigation also works, verify no errors | Success: Settings link appears in navigation, navigates correctly, mobile menu works_

- [ ] 9. Add form validation schemas (note: these should ideally be part of shared contract from Task 0)
  - File: apps/frontend/src/schemas/settings.ts
  - Import and re-use Zod validation schemas from shared contract (@cc-task-manager/schemas)
  - Add client-side specific validation refinements if needed (UI-only validations)
  - Purpose: Use shared contract validation with optional UI-specific enhancements
  - _Leverage: packages/schemas/src/settings/settings.schemas.ts (from Task 0), Zod library_
  - _Requirements: 2.2, 2.4_
  - _Prompt: Role: TypeScript Developer specializing in form validation | Task: Create frontend validation at apps/frontend/src/schemas/settings.ts by importing and re-exporting Zod schemas from @cc-task-manager/schemas for settings forms following requirements 2.2 and 2.4, add client-side specific refinements only if needed for UI validations not relevant to backend (e.g., password confirmation matching, real-time field validation) | Restrictions: Must import base schemas from @cc-task-manager/schemas, do not duplicate validation logic already in shared contract, only add UI-specific refinements using .refine() or .superRefine(), provide clear error messages, note that ideally all validation should be in shared contract from Task 0 | Success: Form validation uses shared contract schemas as foundation, client-specific refinements are minimal and clearly justified, validation works correctly in forms, error messages are clear, no duplicate validation logic between frontend and shared contract_

- [ ] 10. Add tests for settings page
  - File: apps/frontend/src/app/settings/__tests__/page.test.tsx
  - Write comprehensive tests for settings page and components
  - Purpose: Ensure settings functionality works correctly
  - _Leverage: Existing test patterns, React Testing Library_
  - _Requirements: All requirements_
  - _Prompt: Role: QA Engineer | Task: Create comprehensive tests for settings page covering all requirements, testing forms, validation, saving, and user interactions | Restrictions: Must test user-facing behavior, mock API calls, follow test patterns | Success: Tests cover all settings functionality, forms, validation, persistence, and are reliable_

- [ ] 11. Add E2E tests for settings workflow
  - File: apps/frontend/e2e/settings.spec.ts
  - Write end-to-end tests for complete settings workflow
  - Purpose: Verify complete user journey works
  - _Leverage: Existing E2E test setup_
  - _Requirements: All requirements_
  - _Prompt: Role: QA Automation Engineer | Task: Create end-to-end tests for settings page covering complete user workflow from navigation to saving settings | Restrictions: Must test realistic scenarios, ensure tests are maintainable, handle async operations | Success: E2E tests cover full settings workflow, run reliably, catch integration issues_