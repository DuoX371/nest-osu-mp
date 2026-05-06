import { Args, Resolver, Query, ResolveField, Parent, Int } from '@nestjs/graphql';
import { Lobby } from '@prisma-client/prisma/model/lobby.model';
import { LobbyFilterInput } from '../../schema';
import { LobbyService } from '../../service/lobby/lobby.service';
import { Player } from '@prisma-client/prisma/model/player.model';
import type { LobbyWithPlayers } from '../../types/lobby.types';
import { PaginationInput } from '../../schema/pagination.schema';
import { Beatmap } from '@prisma-client/prisma/model/beatmap.model';

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
}
