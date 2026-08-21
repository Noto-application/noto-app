import { Module } from '@nestjs/common';

import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ProjectAccessGuard } from '../guards/project-access.guard';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [JwtAuthModule],
  controllers: [PagesController],
  providers: [PagesService, ProjectAccessGuard],
})
export class PagesModule {}
