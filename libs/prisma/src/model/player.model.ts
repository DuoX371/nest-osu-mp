import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Player {
    @Field(() => Int)
    playerId!: number;

    @Field()
    username!: string;
}