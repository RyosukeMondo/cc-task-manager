# Tasks Document - Analytics Performance Page

## ⚠️ MANDATORY: Contract-First Development
Task 0 MUST be completed before any other tasks. All analytics functionality depends on shared API contracts.

- [x] 0. Define Analytics API contract in shared schemas package
  - File: packages/schemas/src/analytics/analytics.schemas.ts
  - Define all Zod schemas: PerformanceMetricsSchema, KPIDataSchema, ChartDataSchema, TimeSeriesDataSchema, DateRangeSchema, AnalyticsFilterSchema
  - Export from packages/schemas/src/analytics/index.ts and packages/schemas/src/index.ts
  - Build schemas package (cd packages/schemas && pnpm build)
  - Register contracts in ContractRegistry
  - Purpose: Establish single source of truth for analytics data contracts before any implementation
  - _Leverage: packages/schemas/src/tasks/task.schemas.ts pattern, existing ContractRegistry_
  - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4_
  - _Prompt: Role: API Architect with expertise in analytics systems, contract-driven development, Zod schemas, and TypeScript | Task: Define complete Analytics API contract in packages/schemas/src/analytics/analytics.schemas.ts following the task.schemas.ts pattern, including PerformanceMetricsSchema (completionRate, averageCompletionTime, throughput, efficiency, taskVelocity with comprehensive fields and timestamps), KPIDataSchema (value, change, trend, label), ChartDataSchema (labels, datasets, metadata), TimeSeriesDataSchema (timestamp, value, category), DateRangeSchema (startDate, endDate with validation), AnalyticsFilterSchema (dateRange, groupBy, metrics) with full Zod validation rules including number ranges, date formats, array constraints, and comprehensive JSDoc documentation for all fields | Restrictions: Must use Zod for all schemas, follow existing schema patterns from tasks, include comprehensive validation (min/max values, date range validation, enum values for trend/groupBy), document all fields with JSDoc explaining calculation methods and units, ensure schemas compile without errors, export all types and schemas properly from analytics/index.ts and main index.ts, register contracts in ContractRegistry with versioning (v1.0.0), include metadata schemas for chart configuration and display preferences | Success: Analytics schemas defined and compiled successfully, all exports accessible from @cc-task-manager/schemas and @schemas/analytics, contracts registered in registry with proper versioning, both backend and frontend can import without errors, validation rules are comprehensive covering all analytics data types, TypeScript types auto-generated from schemas, JSDoc documentation explains all metrics and calculations, schemas support date range filtering and multiple aggregation options_

- [x] 1. Import performance metrics types from shared schemas instead of defining locally
  - File: apps/frontend/src/types/analytics.ts
  - Import analytics types from @cc-task-manager/schemas instead of defining locally
  - Re-export for convenience: export type { PerformanceMetrics, KPIData, ChartData, TimeSeriesData, DateRange, AnalyticsFilter } from '@cc-task-manager/schemas'
  - Purpose: Use shared contract types to ensure frontend-backend consistency for analytics data
  - _Leverage: packages/schemas/src/analytics/analytics.schemas.ts (from Task 0)_
  - _Requirements: 1.1, 1.4_
  - _Prompt: Role: TypeScript Developer specializing in type systems and contract-driven development | Task: Create type re-export file at apps/frontend/src/types/analytics.ts that imports and re-exports PerformanceMetrics, KPIData, ChartData, TimeSeriesData, DateRange, AnalyticsFilter, and other analytics-related types from @cc-task-manager/schemas following requirements 1.1 and 1.4 | Restrictions: Must import from @cc-task-manager/schemas only, do not define any types locally, only re-export for convenience, ensure tsconfig.json references schemas package, verify types are accessible, do not duplicate analytics type definitions | Success: All analytics types imported from shared schemas, re-exported for frontend use, TypeScript compiles without errors, no duplicate type definitions, frontend has full type coverage from shared contracts for all performance metrics and chart data_

- [x] 2. Create usePerformanceMetrics hook
  - File: apps/frontend/src/hooks/usePerformanceMetrics.ts
  - Implement data fetching hook for performance metrics
  - Purpose: Centralize performance data management
  - _Leverage: Existing API client patterns, similar hooks_
  - _Requirements: 1.1, 1.4_
  - _Prompt: Role: React Developer | Task: Implement usePerformanceMetrics custom hook following requirements 1.1 and 1.4, integrating with API client for metrics data | Restrictions: Handle loading, error, and success states, implement caching | Success: Hook provides performance data with proper state management and error handling_

- [x] 3. Create KPI summary cards component
  - File: apps/frontend/src/components/analytics/KPISummary.tsx
  - Implement cards displaying key performance indicators
  - Purpose: Show summary metrics at a glance
  - _Leverage: Card component from shadcn/ui_
  - _Requirements: 1.1, 1.2_
  - _Prompt: Role: Frontend Developer | Task: Create KPISummary component displaying key performance indicators following requirements 1.1 and 1.2, using Card components | Restrictions: Must show loading skeletons, handle empty states, ensure responsive | Success: KPI cards display correctly with proper styling and loading states_

- [x] 4. Create performance charts component
  - File: apps/frontend/src/components/analytics/PerformanceCharts.tsx
  - Implement chart visualizations for performance data
  - Purpose: Provide visual representation of performance metrics
  - _Leverage: Chart library (Recharts or Chart.js), theme colors_
  - _Requirements: 2.1, 2.2, 2.3_
  - _Prompt: Role: Data Visualization Developer | Task: Create PerformanceCharts component with completion time, throughput, and efficiency charts following requirements 2.1-2.3, using appropriate chart library | Restrictions: Must use theme colors, ensure accessibility, provide tooltips, support responsive design | Success: Charts render correctly, are interactive, accessible, and responsive_

- [x] 5. Create performance page
  - File: apps/frontend/src/app/analytics/performance/page.tsx
  - Create page component integrating KPI cards and charts
  - Purpose: Establish /analytics/performance route
  - _Leverage: KPISummary, PerformanceCharts, page layout patterns_
  - _Requirements: 1.1, 2.1, 3.1_
  - _Prompt: Role: Next.js Developer | Task: Create performance analytics page at apps/frontend/src/app/analytics/performance/page.tsx following requirements 1.1, 2.1, and 3.1, integrating KPI and chart components | Restrictions: Set proper metadata, follow page structure, handle all data states | Success: Page exists, displays metrics and charts, metadata is correct_

- [x] 6. Add date range filter
  - File: apps/frontend/src/app/analytics/performance/page.tsx (continue from task 5)
  - Implement date range selector for filtering metrics
  - Purpose: Allow users to view metrics for specific time periods
  - _Leverage: Date picker component_
  - _Requirements: 2.4_
  - _Prompt: Role: Frontend Developer | Task: Add date range filter to performance page following requirement 2.4, implementing date picker and filter logic | Restrictions: Must update charts when date range changes, maintain URL sync, validate date ranges | Success: Date filter works correctly, charts update, URL reflects selection_

- [x] 7. Uncomment Analytics navigation in Sidebar
  - File: apps/frontend/src/components/layout/Sidebar.tsx
  - Uncomment the Analytics section (lines 92-108)
  - Purpose: Enable navigation to analytics pages
  - _Leverage: Existing navigation structure_
  - _Requirements: 3.1, 3.2, 3.3_
  - _Prompt: Role: Frontend Developer | Task: Uncomment the Analytics section in Sidebar.tsx (lines 92-108) to enable analytics navigation following requirements 3.1-3.3 | Restrictions: Do not uncomment System section yet, ensure no syntax errors | Success: Analytics section visible, navigation works to /analytics/performance, active state highlights correctly_

- [x] 8. Add tests for performance page
  - File: apps/frontend/src/app/analytics/performance/__tests__/page.test.tsx
  - Write comprehensive tests for performance page
  - Purpose: Ensure page and components work correctly
  - _Leverage: Existing test patterns, React Testing Library_
  - _Requirements: All requirements_
  - _Prompt: Role: QA Engineer | Task: Create comprehensive tests for performance analytics page covering all requirements | Restrictions: Mock chart rendering, test data display and interactions, follow test patterns | Success: Tests cover all page functionality, charts, and user interactions reliably_