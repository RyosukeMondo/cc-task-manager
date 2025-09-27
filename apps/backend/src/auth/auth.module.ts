import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CaslAbilityFactory } from './services/casl-ability.factory';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CaslAuthGuard } from './guards/casl-auth.guard';

/**
 * Authentication Module
 *
 * Implements JWT-based authentication with CASL authorization following SOLID principles:
 * - Single Responsibility: Each component has a focused responsibility
 * - Open/Closed: Extensible for new auth strategies without modification
 * - Liskov Substitution: Guards can be substituted based on interface
 * - Interface Segregation: Separate interfaces for different auth concerns
 * - Dependency Inversion: Depends on abstractions through ConfigService
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    CaslAbilityFactory,
    JwtAuthGuard,
    CaslAuthGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    CaslAuthGuard,
    CaslAbilityFactory,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}