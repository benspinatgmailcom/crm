import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OptionalJwtAuthGuard } from './guards/optional-jwt.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { authConfig } from './auth.config';

const config = authConfig().jwt;

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: config.accessSecret,
      signOptions: { expiresIn: config.accessTtl },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OptionalJwtAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
