import { Module } from '@nestjs/common';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';
import { ScraperService } from './service/scraper/scraper.service';
import { ScheduleModule } from '@nestjs/schedule';
import { OsuModule } from '@osu/osu';
import { PrismaModule } from '@prisma-client/prisma';


@Module({
  imports: [
    ScheduleModule.forRoot(),
    OsuModule,
    PrismaModule
  ],
  controllers: [WorkerController],
  providers: [WorkerService, ScraperService],
})
export class WorkerModule { }
