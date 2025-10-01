import { createZodDto } from 'nestjs-zod';
import { updateSettingsSchema } from '@schemas/settings';

/**
 * DTO for updating user settings
 * Generated from Zod schema for consistent validation
 */
export class UpdateSettingsDto extends createZodDto(updateSettingsSchema) {}
