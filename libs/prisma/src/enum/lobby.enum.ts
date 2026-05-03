import { registerEnumType } from "@nestjs/graphql";

export enum LobbyStatus {
    Ongoing = 'ongoing',
    Completed = "completed"
}

registerEnumType(LobbyStatus, {
    name: "LobbyStatus"
})