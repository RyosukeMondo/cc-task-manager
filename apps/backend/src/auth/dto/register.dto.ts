import { registerSchema } from '@repo/schemas';
import { createZodDto } from 'nestjs-zod';

/**
 * Register DTO using Zod schema from shared package
 */
export class RegisterDto extends createZodDto(registerSchema) {}
