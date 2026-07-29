import { Module } from '@nestjs/common';

import { JwtAuthModule } from './jwt-auth.module';

@Module({
  imports: [JwtAuthModule],
})
export class AuthModule {}
