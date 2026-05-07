import { Field, Int, ObjectType } from "@nestjs/graphql";
import { Player } from "./player.model";
import { LobbyStatus } from "../enum/lobby.enum";
import { Beatmap } from "./beatmap.model";

@ObjectType()
export class Lobby {
    @Field(() => Int)
    lobbyId!: number;

    @Field()
    title!: string;

    @Field()
    createdAt!: Date;

    @Field(() => LobbyStatus)
    status!: LobbyStatus;

    @Field(() => [Player], { nullable: true })
    players?: Player[];

    @Field(() => [Beatmap], { nullable: true })
    beatmaps?: Beatmap[]
}

@ObjectType()
export class PaginatedLobbies {
    @Field(() => [Lobby])
    lobbies!: Lobby[]

    @Field(() => Int)
    total!: number
}