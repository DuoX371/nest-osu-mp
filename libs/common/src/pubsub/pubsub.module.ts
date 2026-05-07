import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { PubSub } from 'graphql-subscriptions';

export const PUB_SUB = 'PUB_SUB';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: PUB_SUB,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const redisHost = config.get('REDIS_HOST');

                if (!redisHost) {
                    console.warn('[PubSub] No REDIS_HOST found — using in-memory PubSub (local only)');
                    return new PubSub();
                }

                return new RedisPubSub({
                    connection: {
                        host: redisHost,
                        port: config.get<number>('REDIS_PORT') ?? 6379,
                        username: config.get("REDIS_USERNAME"),
                        password: config.get("REDIS_PASSWORD"),
                    },
                });
            },
        },
    ],
    exports: [PUB_SUB],
})
export class PubsubModule { }
