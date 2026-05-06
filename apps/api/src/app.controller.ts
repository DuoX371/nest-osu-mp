import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipNonce } from './decorator/skip-nonce/skip-nonce.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("/health")
  @SkipNonce()
  getHealth(): string {
    return "OK";
  }
}
