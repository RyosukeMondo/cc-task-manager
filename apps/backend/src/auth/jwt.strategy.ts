import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWTPayload, validateJWTPayload } from '@schemas/auth';

/**
 * JWT Strategy implementation following Interface Segregation Principle
 * Responsible only for validating JWT tokens and extracting user payload
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Validate JWT payload using existing Zod schema validation
   * Demonstrates reuse of existing contract infrastructure
   */
  async validate(payload: any): Promise<JWTPayload> {
    try {
      // Use existing Zod validation from auth schemas
      const validatedPayload = validateJWTPayload(payload);
      
      // Additional business logic validation could go here
      if (new Date() > new Date(validatedPayload.exp * 1000)) {
        throw new UnauthorizedException('Token has expired');
      }
      
      return validatedPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token payload');
    }
  }
}