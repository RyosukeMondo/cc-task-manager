import { loginSchema } from '@schemas/auth';
import { createZodDto } from 'nestjs-zod';

/**
 * Login DTO using Zod schema from shared package
 */
export class LoginDto extends createZodDto(loginSchema) {}
