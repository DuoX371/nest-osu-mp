import { InputType, Field, Int } from "@nestjs/graphql";

@InputType()
export class PaginationInput {
    @Field(() => Int, { nullable: true, defaultValue: 0 })
    skip?: number = 0;

    @Field(() => Int, { nullable: true, defaultValue: 20 })
    limit?: number = 20;
}