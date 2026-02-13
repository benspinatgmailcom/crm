import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@crm/db';
import { AuthService, JwtPayload } from '../auth.service';
import { authConfig } from '../auth.config';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: User }>();
    const auth = request.headers?.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      return true;
    }

    try {
      const config = authConfig().jwt;
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: config.accessSecret,
      });
      if (payload.type !== 'access') return true;

      const user = await this.authService.validateUser(payload);
      if (user) request.user = user;
    } catch {
      // Invalid token - continue without user
    }
    return true;
  }
}
