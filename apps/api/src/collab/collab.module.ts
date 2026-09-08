import { Module } from '@nestjs/common';

import { JwtAuthModule } from '../auth/jwt-auth.module';
import { CollabSecretGuard } from './collab-secret.guard';
import { CollabController } from './collab.controller';
import { CollabService } from './collab.service';

@Module({
  imports: [JwtAuthModule],
  controllers: [CollabController],
  providers: [CollabService, CollabSecretGuard],
})
export class CollabModule {}
