import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor on HTTP routes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(new LoggingInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the health check response through the global interceptor', async () => {
    await request(app.getHttpServer()).get('/health').expect(200, 'OK');
  });
});
