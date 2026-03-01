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
    /** Classic mode: one or more full rows/cols were cleared this turn */
    LINES_CLEARED: 'lines-cleared',
    /** Brief score popup at board center (for juice) */
    SCORE_POPUP: 'score-popup',
    /** Next-piece queue changed — carry the new next PieceModel */
    NEXT_PIECE_CHANGED: 'next-piece-changed',
} as const;
