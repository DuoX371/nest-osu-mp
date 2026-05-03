import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class LobbyFilterInput {
    @Field({ nullable: true })
    title?: string;

    @Field({ nullable: true })
    username?: string;        // search by player username

    @Field(() => Int, { nullable: true })
    playerId?: number;       // search by player osu id

    @Field(() => Int, { nullable: true })
    beatmapsetId?: number;
}