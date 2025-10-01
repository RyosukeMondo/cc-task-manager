import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslAuthGuard } from './guards/casl-auth.guard';
import { UserRepository } from '../users/user.repository';
import { DatabaseModule } from '../database/database.module';

/**
 * Authentication Module following SOLID principles
 * 
 * This module demonstrates:
 * 1. Single Responsibility Principle - focused on authentication and authorization
 * 2. Dependency Inversion Principle - depends on abstractions (ConfigService, etc.)
 * 3. Open/Closed Principle - extensible for new authentication strategies
 * 4. Interface Segregation Principle - clear separation of JWT and CASL concerns
 * 
 * Integrates JWT authentication with CASL authorization for comprehensive security
 */
@Module({
  imports: [
    // Database module for Prisma access
    DatabaseModule,

    // Passport configuration for authentication strategies
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT module configuration with async factory pattern
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('AUTH_JWT_SECRET') || configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('AUTH_JWT_EXPIRES_IN') || configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],

  controllers: [AuthController],

  providers: [
    // Core authentication services
    AuthService,
    JwtStrategy,

    // User repository for database access
    UserRepository,

    // CASL authorization factory
    CaslAbilityFactory,

    // Authentication and authorization guards
    JwtAuthGuard,
    CaslAuthGuard,
  ],
  
  // Export services for use in other modules
  exports: [
    AuthService,
    CaslAbilityFactory,
    JwtAuthGuard,
    CaslAuthGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}