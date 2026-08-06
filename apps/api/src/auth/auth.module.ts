import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthModule } from './jwt-auth.module';
import { PasswordHasherService } from './password-hasher.service';
import { RedisRefreshTokenStore } from './refresh-token.store';

@Module({
  imports: [JwtAuthModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordHasherService, RedisRefreshTokenStore],
  exports: [AuthService, JwtAuthModule],
})
export class AuthModule {}
