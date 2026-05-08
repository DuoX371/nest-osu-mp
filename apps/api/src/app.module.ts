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
        console.error(error); // keep full details in server log
        if (process.env.NODE_ENV === 'production') {
          return {
            message: 'Internal server error',
            code: error.extensions?.code ?? 'INTERNAL_SERVER_ERROR',
          };
        }
        return error; // full detail in dev
      },
    }),
    CommonModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LobbyService,
    LobbyResolver,
    {
      provide: APP_GUARD,
      useClass: NonceGuard,
    }
  ],
})
export class AppModule { }
