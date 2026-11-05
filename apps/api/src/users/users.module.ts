import { Module } from '@nestjs/common';

import { JwtAuthModule } from '../auth/jwt-auth.module';
import { UsersController } from './users.controller';
import { UserAvatarService } from './user-avatar.service';
import { UsersService } from './users.service';

@Module({
  imports: [JwtAuthModule],
  controllers: [UsersController],
  providers: [UsersService, UserAvatarService],
})
export class UsersModule {}
