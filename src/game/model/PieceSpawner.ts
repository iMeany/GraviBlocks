// ---------------------------------------------------------------------------
// PieceSpawner — decides WHERE and FROM WHICH SIDE the next piece appears.
// Pure TypeScript. Zero Phaser imports.
//
// Spawn modes:
//   random — pick a random side each time
//   cw     — cycle top → right → bottom → left
//   ccw    — cycle top → left → bottom → right
// ---------------------------------------------------------------------------

import { PIECE_COLORS } from '../config/Constants';
import type { SpawnMode } from '../config/LevelConfig';
import { PieceModel, SHAPE_NAMES, CLASSIC_SHAPE_NAMES } from './PieceModel';

export type Direction = 'top' | 'bottom' | 'left' | 'right';

const CW_ORDER: Direction[] = ['top', 'right', 'bottom', 'left'];
const CCW_ORDER: Direction[] = ['top', 'left', 'bottom', 'right'];

export interface FallVector {
    dx: number; // −1, 0, or 1
    dy: number; // −1, 0, or 1
}

export class PieceSpawner {
    private mode: SpawnMode;
    private sideIndex = 0;

    constructor(mode: SpawnMode) {
        this.mode = mode;
    }

    /** Get the next spawn side. */
    nextSide(): Direction {
        switch (this.mode) {
            case 'random':
                return CW_ORDER[Math.floor(Math.random() * 4)];
            case 'cw': {
                const side = CW_ORDER[this.sideIndex % 4];
                this.sideIndex++;
                return side;
            }
            case 'ccw': {
                const side = CCW_ORDER[this.sideIndex % 4];
                this.sideIndex++;
                return side;
            }
        }
    }

    /** Unit vector pointing from the spawn edge toward the board center. */
    static fallDirection(side: Direction): FallVector {
        switch (side) {
            case 'top':
                return { dx: 0, dy: 1 };
            case 'bottom':
                return { dx: 0, dy: -1 };
            case 'left':
                return { dx: 1, dy: 0 };
            case 'right':
                return { dx: -1, dy: 0 };
        }
    }

    /**
     * Starting grid position for a piece spawning on the given side.
     * The piece is centered on the perpendicular axis, and pushed inward
     * just enough so that ALL cells of the piece are within the board bounds.
     */
    static spawnPosition(
        side: Direction,
        boardWidth: number,
        boardHeight: number,
        piece: PieceModel,
    ): { col: number; row: number } {
        const midCol = Math.floor(boardWidth / 2);
        const midRow = Math.floor(boardHeight / 2);

        // Compute the piece's bounding box from its offsets
        let minDx = 0;
        let maxDx = 0;
        let minDy = 0;
        let maxDy = 0;
        for (const o of piece.offsets) {
            if (o.dx < minDx) minDx = o.dx;
            if (o.dx > maxDx) maxDx = o.dx;
            if (o.dy < minDy) minDy = o.dy;
            if (o.dy > maxDy) maxDy = o.dy;
        }

        // +1 / -1 inset keeps the whole piece one cell inside the board edge,
        // preventing any clipping when pieces have asymmetric bounding boxes.
        switch (side) {
            case 'top':
                return { col: midCol, row: -minDy + 1 };
            case 'bottom':
                return { col: midCol, row: boardHeight - 1 - maxDy - 1 };
            case 'left':
                return { col: -minDx + 1, row: midRow };
            case 'right':
                return { col: boardWidth - 1 - maxDx - 1, row: midRow };
        }
    }

    /** Create a random piece with a random color.
     *  Pass `classic: true` to restrict to full tetrominoes (no Dot/Duo/Tri).
     */
    static randomPiece(classic = false): PieceModel {
        const pool = classic ? CLASSIC_SHAPE_NAMES : SHAPE_NAMES;
        const name = pool[Math.floor(Math.random() * pool.length)];
        const colorHex = PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)];
        // Convert numeric hex to CSS string for the model (view converts back)
        const color = `#${colorHex.toString(16).padStart(6, '0')}`;
        return new PieceModel(name, color);
    }

    /**
     * For lateral movement, "left" and "right" mean different axes depending
     * on which side the piece is falling from. This returns the two unit
     * vectors for lateral movement given a fall direction.
     *
     * Convention: lateralLeft is counter-clockwise from fall dir,
     *             lateralRight is clockwise.
     */
    static lateralAxes(side: Direction): { left: FallVector; right: FallVector } {
        switch (side) {
            case 'top':
                return { left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
            case 'bottom':
                return { left: { dx: 1, dy: 0 }, right: { dx: -1, dy: 0 } };
            case 'left':
                return { left: { dx: 0, dy: -1 }, right: { dx: 0, dy: 1 } };
            case 'right':
                return { left: { dx: 0, dy: 1 }, right: { dx: 0, dy: -1 } };
        }
    }
}
