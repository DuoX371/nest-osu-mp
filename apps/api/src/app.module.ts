import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@prisma-client/prisma';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { LobbyService } from './service/lobby/lobby.service';
import { LobbyResolver } from './resolver/lobby/lobby.resolver';
import { APP_GUARD } from '@nestjs/core';
import { NonceGuard } from './guards/header/nonce.guard';
import { CommonModule } from '@common/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './guards/gql-throttler/gql-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PrismaModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      // playground: true,
      subscriptions: {
        'graphql-ws': true
      },
      graphiql: process.env.NODE_ENV !== 'production',
      formatError: (error) => {
        console.error(error);
        if (process.env.NODE_ENV === 'production') {
          return {
            message: 'Internal server error',
            code: error.extensions?.code ?? 'INTERNAL_SERVER_ERROR',
          };
        }
        return error;
      },
      context: ({ req, res }) => ({ req, res }),
    }),
    CommonModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LobbyService,
    LobbyResolver,
    {
      provide: APP_GUARD,
      useClass: NonceGuard,
    },
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    }
  ],
})
export class AppModule { }
