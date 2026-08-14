import { Module } from '@nestjs/common';

import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ProjectAccessGuard } from '../guards/project-access.guard';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [JwtAuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessGuard],
})
export class ProjectsModule {}
