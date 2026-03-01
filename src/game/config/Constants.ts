// ---------------------------------------------------------------------------
// Constants — single source of truth for all tuning values.
// Why here? So we never hardcode magic numbers in logic or view code.
// ---------------------------------------------------------------------------

/** Visual */
export const DEFAULT_CELL_SIZE = 48;
export const BOARD_PADDING_RATIO = 0.85; // board uses 85% of screen min-dimension

/** Colors (hex numbers for Phaser) */
export const COLOR_BACKGROUND = 0x1a1a2e;
export const COLOR_GRID_LINE = 0x2a2a4a;
export const COLOR_CELL_EMPTY = 0x16213e;
export const COLOR_CELL_CENTER = 0x444466;
export const COLOR_CELL_TARGET = 0x334455;
export const COLOR_CELL_GHOST = 0xffffff;
export const COLOR_CELL_GHOST_SPILL = 0xffcc99; // barely-orange tint: outside target zone
export const COLOR_CELL_GHOST_WALL  = 0xff2222; // red: piece would reach opposite wall

export const PIECE_COLORS: number[] = [
    0xe94560, // red
    0x0f3460, // blue
    0x53d769, // green
    0xf5a623, // orange
    0xbd10e0, // purple
    0x50e3c2, // teal
    0xf8e71c, // yellow
];

/** Timing (ms) */
export const BASE_FALL_INTERVAL = 600; // ms between automatic fall steps
export const INPUT_REPEAT_RATE = 150;  // ms between repeated lateral key inputs
export const SOFT_DROP_RATE    = 80;   // ms between repeated soft-drop steps
export const LOCK_DELAY_MS     = 150;  // grace period after hard-drop to nudge piece
export const TWEEN_MOVE_MS = 60; // piece grid-move interpolation
export const TWEEN_SQUASH_MS = 80;
export const TWEEN_STRETCH_MS = 100;
export const TWEEN_SETTLE_MS = 120;

/** Side spawn indicator */
export const COLOR_SIDE_ACTIVE   = 0x50e3c2; // bright teal
export const COLOR_SIDE_INACTIVE = 0x1e2a3a; // near-invisible
export const SIDE_INDICATOR_H    = 6;         // px thickness
export const SIDE_INDICATOR_TWEEN_MS = 120;

/** Score popup */
export const COLOR_SCORE_POPUP_LAND  = 0xf8e71c;
export const COLOR_SCORE_POPUP_CLEAR = 0x50e3c2;

/** Screen shake */
export const SHAKE_DURATION = 100;
export const SHAKE_INTENSITY = 0.012;
export const SHAKE_INTENSITY_BIG = 0.025;

/** Particles */
export const PARTICLE_LIFESPAN = 400;
export const PARTICLE_SPEED_MIN = 50;
export const PARTICLE_SPEED_MAX = 150;
export const PARTICLE_COUNT = 10;
