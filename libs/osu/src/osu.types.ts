export interface OsuToken {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
}


export interface OsuMatch {
    match: {
        id: number;
        name: string;
        start_time: string;
        end_time: string | null;
    };
    events: OsuMatchEvent[];
    users: OsuUser[];
    first_event_id: number;
    latest_event_id: number;
    current_game_id: number | null;
}

export interface OsuMatchEvent {
    id: number;
    detail: {
        type: OsuMatchEventTypes;
        text: string;
    };
    user_id?: number;
    timestamp: string;
    game?: {
        beatmap_id: number;
        id: number;
        start_time: string;
        end_time: string;
        match_id: number;
        mode: string;
        mode_int: number;
        scoring_type: string;
        team_type: string;
        mods: string[];
        beatmap: {
            id: number;
            beatmapset_id: number;
        }
        scores: {}[];
    }
}

export interface OsuMatchGame {
    id: number;
    beatmap: OsuBeatmap;
    beatmap_id: number;
    start_time: string;
    end_time: string;
    mode: OsuRuleset;
    mode_int: number;
    mods: string[]; // mod acronyms
    scores: OsuScore[]; // not sure of the structure yet
    scoring_type: 'accuracy' | 'score' | 'combo' | 'scorev2';
    team_type: 'head-to-head' | 'tag-coop' | 'team-vs' | 'tag-team-vs';
}

export enum OsuMatchEventTypes {
    HostChanged = 'host-changed',
    MatchCreated = 'match-created',
    MatchDisbanded = 'match-disbanded',
    Other = 'other',
    PlayerJoined = 'player-joined',
    PlayerKicked = 'player-kicked',
    PlayerLeft = 'player-left'
}

export interface OsuUser {
    avatar_url: string;
    country_code: string;
    default_group?: string;
    id: number;
    is_active: boolean;
    is_bot: boolean;
    is_deleted: boolean;
    is_online: boolean;
    is_supporter: boolean;
    last_visit?: string;
    pm_friends_only: boolean;
    profile_colour?: string;
    username: string;
}

export enum OsuRuleset {
    Osu = 'osu',
    Taiko = 'taiko',
    Fruits = 'fruits',
    Mania = 'mania'
}

// Commenting out for now since not needed
export interface OsuScore {
    accuracy: number;
    beatmap_id: number;
    best_id?: number;
    build_id?: number;
    classic_total_score: number;
    ended_at: string;
    has_replay: boolean;
    id: number;
    is_perfect_combo: boolean;
    legacy_perfect: boolean;
    legacy_score_id?: number;
    legacy_total_score: number;
    // max_combo: number;
    // maximum_statistics: OsuScoreStatistics;
    mods: string[];
    passed: boolean;
    playlist_item_id?: number;
    pp?: number;
    preserve: boolean;
    processed: boolean;
    rank: string;
    ranked: boolean;
    room_id?: number;
    ruleset_id: number;
    started_at?: string;
    // statistics: OsuScoreStatistics;
    total_score: number;
    type: string;
    user_id: number;
}

export interface OsuBeatmap {
    beatmapset_id: number;
    difficulty_rating: number;
    id: number;
    mode: OsuRuleset;
    status: OsuRankStatus;
    total_length: number;
    user_id: number;
    version: string;
}

export enum OsuRankStatus {
    Graveyard = -2,
    WIP = -1,
    Pending = 0,
    Ranked = 1,
    Approved = 2,
    Qualified = 3,
    Loved = 4
}

export interface OsuMatchFormatted {
    lobbyId: number;
    createdAt: Date;
    status: 'ongoing' | 'completed';
    title: string;
    players: { playerId: number; username: string }[];
    maps: { beatmapId: number; beatmapsetId: number }[];
}
