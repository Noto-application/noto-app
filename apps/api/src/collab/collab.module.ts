import { Module } from '@nestjs/common';

import { JwtAuthModule } from '../auth/jwt-auth.module';
import { CollabPersistenceService } from './collab-persistence.service';
import { CollabSecretGuard } from './collab-secret.guard';
import { CollabController } from './collab.controller';
import { CollabService } from './collab.service';

@Module({
  imports: [JwtAuthModule],
  controllers: [CollabController],
  providers: [CollabService, CollabPersistenceService, CollabSecretGuard],
})
export class CollabModule {}
