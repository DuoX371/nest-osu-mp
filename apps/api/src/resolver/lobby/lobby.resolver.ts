import { Args, Resolver, Query, ResolveField, Parent, Int, Subscription, Mutation } from '@nestjs/graphql';
import { Lobby } from '@prisma-client/prisma/model/lobby.model';
import { LobbyFilterInput } from '../../schema';
import { LobbyService } from '../../service/lobby/lobby.service';
import { Player } from '@prisma-client/prisma/model/player.model';
import type { LobbyWithPlayers } from '../../types/lobby.types';
import { PaginationInput } from '../../schema/pagination.schema';
import { Inject } from '@nestjs/common';
import { PUB_SUB } from '@common/common/pubsub/pubsub.module';
import { PubSub } from 'graphql-subscriptions';

export const LOBBY_ADDED = 'lobbyAdded';

@Resolver(() => Lobby)
export class LobbyResolver {
    constructor(
        private readonly lobbyService: LobbyService,
        @Inject(PUB_SUB) private readonly pubSub: PubSub
    ) { }

    @Query(() => [Lobby])
    lobbies(
        @Args('filter', { nullable: true }) filter?: LobbyFilterInput,
        @Args('pagination', { nullable: true }) pagination?: PaginationInput
    ) {
        return this.lobbyService.findAll(filter, pagination);
    }

    @Query(() => Int, { nullable: true })
    latestLobbyId() {
        return this.lobbyService.getLatestLobby();
    }

    @ResolveField(() => [Player])
    players(@Parent() lobby: LobbyWithPlayers) {
        if (!lobby.players) {
            return [];
        }
        return lobby.players.map(lp => lp.player);
    }

    @Subscription(() => Int)
    lobbyAdded() {
        return this.pubSub.asyncIterableIterator(LOBBY_ADDED);
    }
}
