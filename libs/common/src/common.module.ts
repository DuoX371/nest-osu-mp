import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { PubsubModule } from './pubsub/pubsub.module';

@Module({
  providers: [CommonService],
  exports: [CommonService],
  imports: [PubsubModule],
})
export class CommonModule {}
