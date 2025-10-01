import { trendFilterSchema } from '@repo/schemas';
import { createZodDto } from 'nestjs-zod';

/**
 * Trend filter DTO using Zod schema from shared package
 * Validates date range and groupBy parameters for trend queries
 */
export class TrendFilterDto extends createZodDto(trendFilterSchema) {}
