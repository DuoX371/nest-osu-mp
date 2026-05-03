import { Args, Resolver, Query, ResolveField, Parent } from '@nestjs/graphql';
import { Lobby } from '@prisma-client/prisma/model/lobby.model';
import { LobbyFilterInput } from '../../schema';
import { LobbyService } from '../../service/lobby/lobby.service';
import { Player } from '@prisma-client/prisma/model/player.model';
import type { LobbyWithPlayers } from '../../types/lobby.types';
import { PaginationInput } from '../../schema/pagination.schema';

@Resolver(() => Lobby)
export class LobbyResolver {
    constructor(
        private readonly lobbyService: LobbyService
    ) { }

    @Query(() => [Lobby])
    lobbies(
        @Args('filter', { nullable: true }) filter?: LobbyFilterInput,
        @Args('pagination', { nullable: true }) pagination?: PaginationInput
    ) {
        return this.lobbyService.findAll(filter, pagination);
    }

    @ResolveField(() => [Player])
    players(@Parent() lobby: LobbyWithPlayers) {
        if (!lobby.players) {
            return [];
        }
        console.log("lobby", lobby)
        return lobby.players.map(lp => lp.player);
    }
}
