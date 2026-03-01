// ---------------------------------------------------------------------------
// BoardModel — the 2D grid that holds all game state.
// Pure TypeScript. Zero Phaser imports.
//
// The board is a rectangle of cells. Some cells are "center" (immovable),
// some are "target" (must be filled to win), and cells become "occupied"
// when a piece lands on them.
// ---------------------------------------------------------------------------

export interface Cell {
    occupied: boolean;
    color: string | null;
    isCenter: boolean;
    isTarget: boolean;
}

export class BoardModel {
    readonly width: number;
    readonly height: number;
    private grid: Cell[][];

    constructor(
        width: number,
        height: number,
        centerCells: { col: number; row: number }[],
        targetCells: { col: number; row: number }[],
    ) {
        this.width = width;
        this.height = height;

        // Build empty grid
        this.grid = [];
        for (let row = 0; row < height; row++) {
            const rowArr: Cell[] = [];
            for (let col = 0; col < width; col++) {
                rowArr.push({
                    occupied: false,
                    color: null,
                    isCenter: false,
                    isTarget: false,
                });
            }
            this.grid.push(rowArr);
        }

        // Mark center cells (these are always considered occupied / blocking)
        for (const { col, row } of centerCells) {
            if (this.isInBounds(col, row)) {
                this.grid[row][col].isCenter = true;
                this.grid[row][col].occupied = true;
            }
        }

        // Mark target cells
        for (const { col, row } of targetCells) {
            if (this.isInBounds(col, row)) {
                this.grid[row][col].isTarget = true;
            }
        }
    }

    // -----------------------------------------------------------------------
    // Accessors
    // -----------------------------------------------------------------------

    isInBounds(col: number, row: number): boolean {
        return col >= 0 && col < this.width && row >= 0 && row < this.height;
    }

    getCell(col: number, row: number): Cell | null {
        if (!this.isInBounds(col, row)) return null;
        return this.grid[row][col];
    }

    isOccupied(col: number, row: number): boolean {
        const cell = this.getCell(col, row);
        return cell === null || cell.occupied;
    }

    isCenterCell(col: number, row: number): boolean {
        return this.getCell(col, row)?.isCenter ?? false;
    }

    isTargetCell(col: number, row: number): boolean {
        return this.getCell(col, row)?.isTarget ?? false;
    }

    // -----------------------------------------------------------------------
    // Mutations
    // -----------------------------------------------------------------------

    /** Place a block into a cell. Returns false if the cell is already occupied or out of bounds. */
    placeBlock(col: number, row: number, color: string): boolean {
        const cell = this.getCell(col, row);
        if (!cell || cell.occupied) return false;
        cell.occupied = true;
        cell.color = color;
        return true;
    }

    // -----------------------------------------------------------------------
    // Win / Loss checks
    // -----------------------------------------------------------------------

    /** All target cells are occupied → win */
    checkTargetFilled(): boolean {
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const cell = this.grid[row][col];
                if (cell.isTarget && !cell.occupied) return false;
            }
        }
        return true;
    }

    /** Any non-target, non-center cell is occupied → spillage */
    hasSpillage(): boolean {
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const cell = this.grid[row][col];
                if (cell.occupied && !cell.isTarget && !cell.isCenter) return true;
            }
        }
        return false;
    }

    // -----------------------------------------------------------------------
    // Debug
    // -----------------------------------------------------------------------

    /** ASCII dump for console debugging */
    toAscii(): string {
        const rows: string[] = [];
        for (let row = 0; row < this.height; row++) {
            let line = '';
            for (let col = 0; col < this.width; col++) {
                const c = this.grid[row][col];
                if (c.isCenter) line += 'C';
                else if (c.occupied) line += '#';
                else if (c.isTarget) line += '.';
                else line += ' ';
            }
            rows.push(line);
        }
        return rows.join('\n');
    }
}
