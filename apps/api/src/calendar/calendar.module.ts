import { Module } from '@nestjs/common';

import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ProjectAccessGuard } from '../guards/project-access.guard';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [JwtAuthModule],
  controllers: [CalendarController],
  providers: [CalendarService, ProjectAccessGuard],
})
export class CalendarModule {}
