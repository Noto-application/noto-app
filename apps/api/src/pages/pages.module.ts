import { Module } from '@nestjs/common';

import { JwtAuthModule } from '../auth/jwt-auth.module';
import { DeletedPageAccessGuard } from '../guards/deleted-page-access.guard';
import { PageAccessGuard } from '../guards/page-access.guard';
import { ProjectAccessGuard } from '../guards/project-access.guard';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [JwtAuthModule],
  controllers: [PagesController],
  providers: [PagesService, ProjectAccessGuard, PageAccessGuard, DeletedPageAccessGuard],
})
export class PagesModule {}
