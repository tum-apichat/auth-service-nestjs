// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { Logger } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validate JWT token
   * @param payload - JWT payload
   * @returns User object if valid, throws exception otherwise
   */
  async validate(payload: JwtPayload) {
    try {
      const user = await this.usersService.findByUsername(payload.username);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.is_active) {
        throw new UnauthorizedException('Account is disabled');
      }

      // Handle Duo verification status
      const tokenDuoVerified = payload.duoVerified === true;
      const dbDuoVerified = user.duo_verified === true;

      // Update database if token has verified but database hasn't
      if (tokenDuoVerified && !dbDuoVerified) {
        await this.usersService.updateDuoVerification(user.id, true);
      }

      // Return user info to be attached to request
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.fullname,
        requiresDuo: user.required_duo,
        duoVerified: user.duo_verified,
      };
    } catch (error: unknown) {
      // ถ้าเป็น UnauthorizedException ที่เราโยนเอง ให้ส่งต่อไปเลย
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // ถ้าเป็น error อื่นๆ จึงจะโยน Invalid token
      this.logger.error('Error validating JWT token', error);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
