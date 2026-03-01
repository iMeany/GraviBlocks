// ---------------------------------------------------------------------------
// GameEvents — string constants for every event the model can emit.
// Using constants instead of raw strings prevents typo bugs and gives us
// a single place to see every cross-layer communication channel.
// ---------------------------------------------------------------------------

export const GameEvents = {
    /** Fired when a new piece appears at the board edge */
    PIECE_SPAWNED: 'piece-spawned',
    /** Fired every time the piece advances one grid step toward center */
    PIECE_MOVED: 'piece-moved',
    /** Fired when the player rotates the piece */
    PIECE_ROTATED: 'piece-rotated',
    /** Fired when the piece freezes in place on the board */
    PIECE_LANDED: 'piece-landed',
    /** Player wins — all target cells filled */
    GAME_WON: 'game-won',
    /** Player loses — piece landed outside target or can't spawn */
    GAME_OVER: 'game-over',
    /** Score changed */
    SCORE_CHANGED: 'score-changed',
    /** Level loaded / changed */
    LEVEL_LOADED: 'level-loaded',
} as const;
