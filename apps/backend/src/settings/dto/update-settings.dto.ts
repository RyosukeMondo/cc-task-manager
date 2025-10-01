import { createZodDto } from 'nestjs-zod';
import { updateSettingsSchema } from '@repo/schemas';

/**
 * DTO for updating user settings
 * Generated from Zod schema for consistent validation
 */
export class UpdateSettingsDto extends createZodDto(updateSettingsSchema) {}
