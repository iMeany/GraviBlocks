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
    // Classic mode — line clear
    // -----------------------------------------------------------------------

    /** Return indices of rows where every target cell in that row is occupied.
     *  Only rows that actually contain at least one target cell can clear.
     */
    findFullRows(): number[] {
        const full: number[] = [];
        for (let row = 0; row < this.height; row++) {
            let targetCount = 0;
            let filledCount = 0;
            for (let col = 0; col < this.width; col++) {
                const cell = this.grid[row][col];
                if (cell.isTarget) {
                    targetCount++;
                    if (cell.occupied) filledCount++;
                }
            }
            if (targetCount > 0 && filledCount === targetCount) full.push(row);
        }
        return full;
    }

    /** Return indices of columns where every target cell in that column is occupied. */
    findFullCols(): number[] {
        const full: number[] = [];
        for (let col = 0; col < this.width; col++) {
            let targetCount = 0;
            let filledCount = 0;
            for (let row = 0; row < this.height; row++) {
                const cell = this.grid[row][col];
                if (cell.isTarget) {
                    targetCount++;
                    if (cell.occupied) filledCount++;
                }
            }
            if (targetCount > 0 && filledCount === targetCount) full.push(col);
        }
        return full;
    }

    /** Clear occupied blocks from all target cells in this row, then extend
     *  outward (left and right) as long as cells remain consecutively occupied.
     *  Stops at the first empty or out-of-bounds cell.
     */
    clearRow(row: number): void {
        // Find the target-zone span for this row
        let minTargetCol = this.width;
        let maxTargetCol = -1;
        for (let col = 0; col < this.width; col++) {
            if (this.grid[row][col].isTarget) {
                if (col < minTargetCol) minTargetCol = col;
                if (col > maxTargetCol) maxTargetCol = col;
            }
        }
        if (maxTargetCol === -1) return;

        // Clear the target cells themselves (never touch the immovable center cells)
        for (let col = minTargetCol; col <= maxTargetCol; col++) {
            const cell = this.grid[row][col];
            if (cell.isTarget && !cell.isCenter) { cell.occupied = false; cell.color = null; }
        }

        // Extend left while consecutively occupied
        for (let col = minTargetCol - 1; col >= 0; col--) {
            const cell = this.grid[row][col];
            if (!cell.isCenter && cell.occupied) { cell.occupied = false; cell.color = null; }
            else break;
        }
        // Extend right while consecutively occupied
        for (let col = maxTargetCol + 1; col < this.width; col++) {
            const cell = this.grid[row][col];
            if (!cell.isCenter && cell.occupied) { cell.occupied = false; cell.color = null; }
            else break;
        }
    }

    /** Clear occupied blocks from all target cells in this column, then extend
     *  outward (up and down) as long as cells remain consecutively occupied.
     */
    clearCol(col: number): void {
        let minTargetRow = this.height;
        let maxTargetRow = -1;
        for (let row = 0; row < this.height; row++) {
            if (this.grid[row][col].isTarget) {
                if (row < minTargetRow) minTargetRow = row;
                if (row > maxTargetRow) maxTargetRow = row;
            }
        }
        if (maxTargetRow === -1) return;

        for (let row = minTargetRow; row <= maxTargetRow; row++) {
            const cell = this.grid[row][col];
            if (cell.isTarget && !cell.isCenter) { cell.occupied = false; cell.color = null; }
        }

        // Extend upward while consecutively occupied
        for (let row = minTargetRow - 1; row >= 0; row--) {
            const cell = this.grid[row][col];
            if (!cell.isCenter && cell.occupied) { cell.occupied = false; cell.color = null; }
            else break;
        }
        // Extend downward while consecutively occupied
        for (let row = maxTargetRow + 1; row < this.height; row++) {
            const cell = this.grid[row][col];
            if (!cell.isCenter && cell.occupied) { cell.occupied = false; cell.color = null; }
            else break;
        }
    }

    /**
     * Compact target-zone cells toward the board center after zone lines clear.
     * Only target cells are moved; spillage blocks outside the zone stay put.
     * Above-center target rows shift downward; below-center upward.
     * Left-of-center target cols shift rightward; right-of-center leftward.
     */
    shiftInward(_clearedRows: number[], _clearedCols: number[]): void {
        const centerRow = Math.floor(this.height / 2);
        const centerCol = Math.floor(this.width / 2);

        // Bounding box of target cells
        let minTargetRow = this.height, maxTargetRow = -1;
        let minTargetCol = this.width,  maxTargetCol = -1;
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                if (this.grid[r][c].isTarget) {
                    if (r < minTargetRow) minTargetRow = r;
                    if (r > maxTargetRow) maxTargetRow = r;
                    if (c < minTargetCol) minTargetCol = c;
                    if (c > maxTargetCol) maxTargetCol = c;
                }
            }
        }
        if (maxTargetRow === -1) return;

        // Vertical compaction within each target column (only when rows were cleared)
        if (_clearedRows.length > 0)
        for (let c = minTargetCol; c <= maxTargetCol; c++) {
            // Top half: compact downward toward center
            const top: (string | null)[] = [];
            for (let r = minTargetRow; r < centerRow; r++) {
                const cell = this.grid[r][c];
                if (cell.isTarget && !cell.isCenter && cell.occupied) top.push(cell.color);
            }
            for (let r = minTargetRow; r < centerRow; r++) {
                const cell = this.grid[r][c];
                if (cell.isTarget && !cell.isCenter) { cell.occupied = false; cell.color = null; }
            }
            let fill = centerRow - 1;
            for (let i = top.length - 1; i >= 0; i--) {
                while (fill >= minTargetRow && (!this.grid[fill][c].isTarget || this.grid[fill][c].isCenter)) fill--;
                if (fill < minTargetRow) break;
                this.grid[fill][c].occupied = true; this.grid[fill][c].color = top[i]; fill--;
            }

            // Bottom half: compact upward toward center
            const bot: (string | null)[] = [];
            for (let r = maxTargetRow; r > centerRow; r--) {
                const cell = this.grid[r][c];
                if (cell.isTarget && !cell.isCenter && cell.occupied) bot.push(cell.color);
            }
            for (let r = centerRow + 1; r <= maxTargetRow; r++) {
                const cell = this.grid[r][c];
                if (cell.isTarget && !cell.isCenter) { cell.occupied = false; cell.color = null; }
            }
            fill = centerRow + 1;
            for (let i = bot.length - 1; i >= 0; i--) {
                while (fill <= maxTargetRow && (!this.grid[fill][c].isTarget || this.grid[fill][c].isCenter)) fill++;
                if (fill > maxTargetRow) break;
                this.grid[fill][c].occupied = true; this.grid[fill][c].color = bot[i]; fill++;
            }
        }

        // Horizontal compaction within each target row (only when cols were cleared)
        if (_clearedCols.length > 0)
        for (let r = minTargetRow; r <= maxTargetRow; r++) {
            // Left half: compact rightward toward center
            const lft: (string | null)[] = [];
            for (let c = minTargetCol; c < centerCol; c++) {
                const cell = this.grid[r][c];
                if (cell.isTarget && !cell.isCenter && cell.occupied) lft.push(cell.color);
            }
            for (let c = minTargetCol; c < centerCol; c++) {
                const cell = this.grid[r][c];
                if (cell.isTarget && !cell.isCenter) { cell.occupied = false; cell.color = null; }
            }
            let fill = centerCol - 1;
            for (let i = lft.length - 1; i >= 0; i--) {
                while (fill >= minTargetCol && (!this.grid[r][fill].isTarget || this.grid[r][fill].isCenter)) fill--;
                if (fill < minTargetCol) break;
                this.grid[r][fill].occupied = true; this.grid[r][fill].color = lft[i]; fill--;
            }

            // Right half: compact leftward toward center
            const rgt: (string | null)[] = [];
            for (let c = maxTargetCol; c > centerCol; c--) {
                const cell = this.grid[r][c];
                if (cell.isTarget && !cell.isCenter && cell.occupied) rgt.push(cell.color);
            }
            for (let c = centerCol + 1; c <= maxTargetCol; c++) {
                const cell = this.grid[r][c];
                if (cell.isTarget && !cell.isCenter) { cell.occupied = false; cell.color = null; }
            }
            fill = centerCol + 1;
            for (let i = rgt.length - 1; i >= 0; i--) {
                while (fill <= maxTargetCol && (!this.grid[r][fill].isTarget || this.grid[r][fill].isCenter)) fill++;
                if (fill > maxTargetCol) break;
                this.grid[r][fill].occupied = true; this.grid[r][fill].color = rgt[i]; fill++;
            }
        }
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
