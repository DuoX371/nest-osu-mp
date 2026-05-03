import { Module } from '@nestjs/common';
import { OsuService } from './osu.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  providers: [OsuService],
  exports: [OsuService],
  imports: [
    HttpModule,
    ConfigModule.forRoot()
  ]
})
export class OsuModule { }
