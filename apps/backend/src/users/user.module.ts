import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

/**
 * User Module organizing user management components
 * Following Single Responsibility Principle - manages user-related concerns
 */
@Module({
  imports: [
    DatabaseModule, // For PrismaService
    AuthModule, // For CaslAbilityFactory
  ],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository], // Export for use in other modules
})
export class UserModule {}