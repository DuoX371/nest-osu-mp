import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './interceptor/logging.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Cloudflare -> Traefik -> API. Read the client IP from the nearest two
  // trusted proxy hops, not from an arbitrary leftmost forwarded header.
  app.set('trust proxy', 2);
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors({
    origin: ['https://osump.chooh.moe', "http://localhost:3001", "https://osump.reisal.in"]
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
