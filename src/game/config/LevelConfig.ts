// ---------------------------------------------------------------------------
// LevelConfig — data-only description of a level.
// Pure TypeScript, no Phaser imports.
// ---------------------------------------------------------------------------

export type SpawnMode = 'random' | 'cw' | 'ccw';

export interface LevelConfig {
    /** Display name */
    name: string;
    /** Board dimensions in cells */
    boardWidth: number;
    boardHeight: number;
    /** Cells that form the immovable center piece (board coordinates) */
    centerCells: { col: number; row: number }[];
    /** Cells that must be filled to win (board coordinates) */
    targetCells: { col: number; row: number }[];
    /** How the next spawn side is chosen */
    spawnMode: SpawnMode;
    /** Base time between automatic fall steps (ms) */
    fallInterval: number;
}

// ---------------------------------------------------------------------------
// Starter levels — small set for MVP
// ---------------------------------------------------------------------------

/** Helper: generate a filled rectangle of cells */
function rect(
    startCol: number,
    startRow: number,
    w: number,
    h: number,
): { col: number; row: number }[] {
    const cells: { col: number; row: number }[] = [];
    for (let r = startRow; r < startRow + h; r++) {
        for (let c = startCol; c < startCol + w; c++) {
            cells.push({ col: c, row: r });
        }
    }
    return cells;
}

/**
 * Level 1: 9×9 board, single center cell, 3×3 target square around center.
 */
const level1: LevelConfig = {
    name: 'Level 1 — Tiny Square',
    boardWidth: 9,
    boardHeight: 9,
    centerCells: [{ col: 4, row: 4 }],
    targetCells: rect(3, 3, 3, 3),
    spawnMode: 'random',
    fallInterval: 600,
};

/**
 * Level 2: 11×11 board, 2×2 center, 5×5 target.
 */
const level2: LevelConfig = {
    name: 'Level 2 — Growing Block',
    boardWidth: 11,
    boardHeight: 11,
    centerCells: rect(4, 4, 2, 2),
    targetCells: rect(3, 3, 5, 5),
    spawnMode: 'cw',
    fallInterval: 500,
};

/**
 * Level 3: 11×11, 1×1 center, cross-shaped target.
 */
const level3: LevelConfig = {
    name: 'Level 3 — The Cross',
    boardWidth: 11,
    boardHeight: 11,
    centerCells: [{ col: 5, row: 5 }],
    targetCells: [
        // vertical bar
        ...rect(5, 2, 1, 7),
        // horizontal bar
        ...rect(2, 5, 7, 1),
    ],
    spawnMode: 'random',
    fallInterval: 500,
};

export const LEVELS: LevelConfig[] = [level1, level2, level3];
