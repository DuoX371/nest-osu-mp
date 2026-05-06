import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { ScraperService } from './service/scraper/scraper.service';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule);
  const scraper = app.get(ScraperService);

  // await scraper.scrapeMatch(120026514);
  await app.listen(3002);
}
bootstrap();
