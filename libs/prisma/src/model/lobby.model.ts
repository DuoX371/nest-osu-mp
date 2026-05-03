import { Field, Int, ObjectType } from "@nestjs/graphql";
import { Player } from "./player.model";
import { LobbyStatus } from "../enum/lobby.enum";

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

    // @Field(() => [BeatMap])
}