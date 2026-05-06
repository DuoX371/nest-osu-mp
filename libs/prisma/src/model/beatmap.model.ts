import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class Beatmap {
    @Field(() => Int)
    beatmapId!: number

    @Field(() => Int)
    beatmapSetId!: number

    @Field(() => Int)
    lobbyId!: number
}