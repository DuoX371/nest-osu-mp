import { Module } from '@nestjs/common';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';
import { ScraperService } from './service/scraper/scraper.service';
import { ScheduleModule } from '@nestjs/schedule';
import { OsuModule } from '@osu/osu';
import { PrismaModule } from '@prisma-client/prisma';
import { CommonModule } from '@common/common';


@Module({
  imports: [
    ScheduleModule.forRoot(),
    OsuModule,
    PrismaModule,
    CommonModule
  ],
  controllers: [WorkerController],
  providers: [WorkerService, ScraperService],
})
export class WorkerModule { }
