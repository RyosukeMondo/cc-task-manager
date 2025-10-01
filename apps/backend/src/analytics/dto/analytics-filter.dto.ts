import { analyticsFilterSchema } from '@schemas/analytics';
import { createZodDto } from 'nestjs-zod';

/**
 * Analytics filter DTO using Zod schema from shared package
 * Validates date range parameters for analytics queries
 */
export class AnalyticsFilterDto extends createZodDto(analyticsFilterSchema) {}
