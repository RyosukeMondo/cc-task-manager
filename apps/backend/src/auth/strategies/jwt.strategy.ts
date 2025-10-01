import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

/**
 * JWT Strategy implementation for Passport authentication
 *
 * Responsibilities:
 * - Extract JWT from Authorization header (Bearer token)
 * - Validate JWT signature using AUTH_JWT_SECRET
 * - Verify user exists in database
 * - Verify session exists and is not logged out (soft deleted)
 * - Attach user object to request context
 *
 * Security notes:
 * - Validates both user and session to prevent token reuse after logout
 * - Checks for soft-deleted users (deletedAt !== null)
 * - Checks for soft-deleted sessions (deletedAt !== null)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('AUTH_JWT_SECRET'),
    });
  }

  /**
   * Validate JWT payload and verify user/session existence
   * Called automatically by Passport after JWT signature verification
   *
   * @param payload - JWT payload containing { sub: userId, email, iat, exp }
   * @returns User object (without password) to be attached to request
   * @throws UnauthorizedException if user or session is invalid
   */
  async validate(payload: any) {
    const userId = payload.sub;

    // Verify user exists and is not deleted
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.deletedAt !== null) {
      throw new UnauthorizedException('User account has been deleted');
    }

    // Verify at least one active session exists (not soft-deleted)
    // This prevents token reuse after logout
    const activeSession = await this.prisma.session.findFirst({
      where: {
        userId: userId,
        deletedAt: null, // Session is not logged out
        expiresAt: {
          gte: new Date(), // Session has not expired
        },
      },
    });

    if (!activeSession) {
      throw new UnauthorizedException('No active session found. Please log in again.');
    }

    // Return user object (without password) to attach to request
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    };
  }
}
