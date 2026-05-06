import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './interceptor/logging.interceptor';
import { NonceGuard } from './guards/header/nonce.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors({
    origin: ['https://osump.chooh.moe', "http://localhost:3001"]
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
