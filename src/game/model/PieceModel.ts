// ---------------------------------------------------------------------------
// PieceModel — a falling puzzle piece.
// Pure TypeScript. Zero Phaser imports.
//
// A piece is defined by an array of relative cell offsets from a pivot point.
// Rotation transforms these offsets by 90° around the pivot.
// ---------------------------------------------------------------------------

export interface Offset {
    dx: number;
    dy: number;
}

/** Standard Tetromino shapes as relative offsets from pivot (0,0). */
export const SHAPES: Record<string, Offset[]> = {
    I: [{ dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }],
    O: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }],
    T: [{ dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }],
    S: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: -1, dy: 1 }, { dx: 0, dy: 1 }],
    Z: [{ dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }],
    L: [{ dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 }],
    J: [{ dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: -1, dy: 1 }],
    // Small shapes for early levels
    Dot: [{ dx: 0, dy: 0 }],
    Duo: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }],
    Tri: [{ dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 1, dy: 0 }],
};

export const SHAPE_NAMES = Object.keys(SHAPES);

export class PieceModel {
    offsets: Offset[];
    readonly shapeName: string;
    readonly color: string;

    constructor(shapeName: string, color: string) {
        const template = SHAPES[shapeName];
        if (!template) throw new Error(`Unknown shape: ${shapeName}`);
        // Deep-copy so rotation doesn't mutate the template
        this.offsets = template.map((o) => ({ ...o }));
        this.shapeName = shapeName;
        this.color = color;
    }

    /** Rotate 90° clockwise: (dx, dy) → (−dy, dx) */
    rotateCW(): void {
        for (const o of this.offsets) {
            const tmp = o.dx;
            o.dx = -o.dy;
            o.dy = tmp;
        }
    }

    /** Rotate 90° counter-clockwise: (dx, dy) → (dy, −dx) */
    rotateCCW(): void {
        for (const o of this.offsets) {
            const tmp = o.dx;
            o.dx = o.dy;
            o.dy = -tmp;
        }
    }

    /** Project offsets onto absolute board coordinates given the piece pivot position. */
    getAbsoluteCells(pivotCol: number, pivotRow: number): { col: number; row: number }[] {
        return this.offsets.map((o) => ({
            col: pivotCol + o.dx,
            row: pivotRow + o.dy,
        }));
    }
}
