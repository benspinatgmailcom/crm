import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from '../auth.service';
import { User } from '@crm/db';
import { authConfig } from '../auth.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    const config = authConfig().jwt;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.accessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.authService.validateUser(payload);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
