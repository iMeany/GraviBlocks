// ---------------------------------------------------------------------------
// GameSimulation — orchestrates the model layer.
// Pure TypeScript. Zero Phaser imports.
//
// Owns: BoardModel, PieceSpawner, current piece, score, game phase.
// Communicates outward only through the EventBus.
// ---------------------------------------------------------------------------

import type { LevelConfig } from '../config/LevelConfig';
import type { GameMode } from '../config/LevelConfig';
import { eventBus } from '../events/EventBus';
import { GameEvents } from '../events/GameEvents';
import { BoardModel } from './BoardModel';
import type { PieceModel } from './PieceModel';
import { type Direction, type FallVector, PieceSpawner } from './PieceSpawner';

export type GamePhase = 'idle' | 'spawning' | 'falling' | 'lock-delay' | 'landing' | 'won' | 'game-over';

export class GameSimulation {
    board!: BoardModel;
    private spawner!: PieceSpawner;

    /** Currently falling piece (null between land and next spawn) */
    currentPiece: PieceModel | null = null;
    /** Board position of the piece's pivot */
    pieceCol = 0;
    pieceRow = 0;
    /** Which side the current piece fell from */
    pieceSide: Direction = 'top';
    /** Fall direction vector for the current piece */
    fallDir: FallVector = { dx: 0, dy: 1 };

    phase: GamePhase = 'idle';
    score = 0;
    piecesLanded = 0;
    mode: GameMode = 'normal';
    /** The piece that will spawn next (shown in preview). */
    nextPiece: PieceModel | null = null;
    private levelConfig!: LevelConfig;

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    /** Load a level and reset all state. */
    loadLevel(config: LevelConfig, mode: GameMode = 'normal'): void {
        this.levelConfig = config;
        this.mode = mode;
        this.board = new BoardModel(config.boardWidth, config.boardHeight, config.centerCells, config.targetCells);
        this.spawner = new PieceSpawner(config.spawnMode);
        this.currentPiece = null;
        this.nextPiece = PieceSpawner.randomPiece(mode === 'classic'); // pre-generate for preview
        this.phase = 'idle';
        this.score = 0;
        this.piecesLanded = 0;
        eventBus.emit(GameEvents.LEVEL_LOADED, config);
        eventBus.emit(GameEvents.NEXT_PIECE_CHANGED, this.nextPiece);
    }

    getLevelConfig(): LevelConfig {
        return this.levelConfig;
    }

    // -----------------------------------------------------------------------
    // Spawning
    // -----------------------------------------------------------------------

    /** Spawn the next piece at a board edge. Returns false if blocked (game over). */
    spawnPiece(): boolean {
        if (this.phase === 'won' || this.phase === 'game-over') return false;

        // Use pre-generated next piece, then queue a new one
        const piece = this.nextPiece ?? PieceSpawner.randomPiece(this.mode === 'classic');
        this.nextPiece = PieceSpawner.randomPiece(this.mode === 'classic');
        eventBus.emit(GameEvents.NEXT_PIECE_CHANGED, this.nextPiece);

        const side = this.spawner.nextSide();
        const pos = PieceSpawner.spawnPosition(side, this.board.width, this.board.height, piece);

        // Check if spawn position is already blocked
        const cells = piece.getAbsoluteCells(pos.col, pos.row);
        for (const { col, row } of cells) {
            if (this.board.isOccupied(col, row)) {
                this.phase = 'game-over';
                eventBus.emit(GameEvents.GAME_OVER, 'spawn-blocked');
                return false;
            }
        }

        this.currentPiece = piece;
        this.pieceCol = pos.col;
        this.pieceRow = pos.row;
        this.pieceSide = side;
        this.fallDir = PieceSpawner.fallDirection(side);
        this.phase = 'falling';

        eventBus.emit(GameEvents.PIECE_SPAWNED, {
            piece,
            col: pos.col,
            row: pos.row,
            side,
        });
        return true;
    }

    // -----------------------------------------------------------------------
    // Movement
    // -----------------------------------------------------------------------

    /** Advance piece one step in fall direction. Returns true if it moved. */
    tick(): boolean {
        if (this.phase !== 'falling' || !this.currentPiece) return false;

        const nextCol = this.pieceCol + this.fallDir.dx;
        const nextRow = this.pieceRow + this.fallDir.dy;

        if (this.canPlacePiece(this.currentPiece, nextCol, nextRow)) {
            this.pieceCol = nextCol;
            this.pieceRow = nextRow;
            eventBus.emit(GameEvents.PIECE_MOVED, {
                col: this.pieceCol,
                row: this.pieceRow,
            });
            return true;
        }

        // Can't move further → land
        this.landPiece();
        return false;
    }

    /**
     * Move piece laterally (perpendicular to fall direction).
     * direction: 'left' or 'right' in screen-space (absolute arrow keys).
     */
    moveLateral(direction: 'left' | 'right'): boolean {
        if (this.phase !== 'falling' || !this.currentPiece) return false;

        // Map absolute screen direction to grid delta
        let dCol = 0;
        const dRow = 0;
        if (direction === 'left') dCol = -1;
        else if (direction === 'right') dCol = 1;

        // For vertical falls, left/right map to columns.
        // For horizontal falls (from left/right side), left/right map to rows.
        // But we're doing absolute controls for MVP, so left arrow = col-1, right arrow = col+1,
        // up arrow = row-1, down arrow = row+1.
        const nextCol = this.pieceCol + dCol;
        const nextRow = this.pieceRow + dRow;

        if (this.canPlacePiece(this.currentPiece, nextCol, nextRow)) {
            this.pieceCol = nextCol;
            this.pieceRow = nextRow;
            eventBus.emit(GameEvents.PIECE_MOVED, {
                col: this.pieceCol,
                row: this.pieceRow,
            });
            return true;
        }
        return false;
    }

    /**
     * Move piece in an absolute direction (up/down/left/right on screen).
     * This is longer-form of moveLateral that handles all 4 directions,
     * but only allows movement perpendicular to fall direction.
     */
    moveAbsolute(dir: 'up' | 'down' | 'left' | 'right'): boolean {
        if ((this.phase !== 'falling' && this.phase !== 'lock-delay') || !this.currentPiece) return false;

        let dCol = 0;
        let dRow = 0;
        switch (dir) {
            case 'up':
                dRow = -1;
                break;
            case 'down':
                dRow = 1;
                break;
            case 'left':
                dCol = -1;
                break;
            case 'right':
                dCol = 1;
                break;
        }

        // Only allow movement perpendicular to fall direction
        // (don't let player push piece backward or accelerate it beyond tick)
        const dotProduct = dCol * this.fallDir.dx + dRow * this.fallDir.dy;
        if (dotProduct !== 0) return false; // parallel to fall — disallow

        const nextCol = this.pieceCol + dCol;
        const nextRow = this.pieceRow + dRow;

        if (this.canPlacePiece(this.currentPiece, nextCol, nextRow)) {
            this.pieceCol = nextCol;
            this.pieceRow = nextRow;
            eventBus.emit(GameEvents.PIECE_MOVED, {
                col: this.pieceCol,
                row: this.pieceRow,
            });
            return true;
        }
        return false;
    }

    /** Rotate piece. Returns true if successful. */
    rotatePiece(dir: 'CW' | 'CCW'): boolean {
        if ((this.phase !== 'falling' && this.phase !== 'lock-delay') || !this.currentPiece) return false;

        // Try rotation; revert if it causes a collision
        if (dir === 'CW') this.currentPiece.rotateCW();
        else this.currentPiece.rotateCCW();

        if (this.canPlacePiece(this.currentPiece, this.pieceCol, this.pieceRow)) {
            eventBus.emit(GameEvents.PIECE_ROTATED, {
                col: this.pieceCol,
                row: this.pieceRow,
            });
            return true;
        }

        // Revert
        if (dir === 'CW') this.currentPiece.rotateCCW();
        else this.currentPiece.rotateCW();
        return false;
    }

    /** Instantly drop piece to its final position along the fall axis, then
     *  enter lock-delay so the player has a brief window to nudge laterally.
     */
    hardDrop(): void {
        if (this.phase !== 'falling' || !this.currentPiece) return;

        while (
            this.canPlacePiece(this.currentPiece, this.pieceCol + this.fallDir.dx, this.pieceRow + this.fallDir.dy)
        ) {
            this.pieceCol += this.fallDir.dx;
            this.pieceRow += this.fallDir.dy;
        }

        eventBus.emit(GameEvents.PIECE_MOVED, {
            col: this.pieceCol,
            row: this.pieceRow,
        });

        // Don't land yet — scene will call commitLand() after grace period
        this.phase = 'lock-delay';
    }

    /** Commit the current piece to the board. Called by GameScene after lock-delay. */
    commitLand(): void {
        if (this.phase !== 'lock-delay' || !this.currentPiece) return;
        this.landPiece();
    }

    /**
     * Compute where the piece would end up if hard-dropped from current position.
     * Used to render the ghost piece.
     */
    getGhostPosition(): { col: number; row: number } | null {
        if (!this.currentPiece) return null;
        let ghostCol = this.pieceCol;
        let ghostRow = this.pieceRow;

        while (this.canPlacePiece(this.currentPiece, ghostCol + this.fallDir.dx, ghostRow + this.fallDir.dy)) {
            ghostCol += this.fallDir.dx;
            ghostRow += this.fallDir.dy;
        }
        return { col: ghostCol, row: ghostRow };
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    /** Check if a piece fits at a given position without collisions. */
    private canPlacePiece(piece: PieceModel, col: number, row: number): boolean {
        const cells = piece.getAbsoluteCells(col, row);
        for (const { col: c, row: r } of cells) {
            if (!this.board.isInBounds(c, r)) return false;
            if (this.board.isOccupied(c, r)) return false;
        }
        return true;
    }

    /** Freeze the current piece into the board. */
    private landPiece(): void {
        if (!this.currentPiece) return;

        const cells = this.currentPiece.getAbsoluteCells(this.pieceCol, this.pieceRow);
        for (const { col, row } of cells) {
            this.board.placeBlock(col, row, this.currentPiece.color);
        }

        this.piecesLanded++;

        // --- Landing score ---
        let landScore = 0;
        if (this.mode === 'classic') {
            const onTarget = cells.filter(({ col, row }) => this.board.isTargetCell(col, row)).length;
            if (onTarget === cells.length) landScore = 100;
            else if (onTarget > 0)         landScore = 25;
        } else {
            landScore = 10; // normal mode flat score
        }
        this.score += landScore;

        const landedInfo = {
            cells,
            color: this.currentPiece.color,
            side: this.pieceSide,
        };

        this.currentPiece = null;
        this.phase = 'landing';

        eventBus.emit(GameEvents.PIECE_LANDED, landedInfo);
        if (landScore > 0) {
            eventBus.emit(GameEvents.SCORE_POPUP, { amount: landScore, type: 'land' });
        }
        eventBus.emit(GameEvents.SCORE_CHANGED, this.score);

        if (this.mode === 'classic') {
            // --- Line / column clear ---
            const fullRows = this.board.findFullRows();
            const fullCols = this.board.findFullCols();
            const n = fullRows.length + fullCols.length;

            if (n > 0) {
                // Score: 200 per clear + 50 bonus per extra clear beyond the first
                const clearScore = 200 * n + 50 * Math.max(0, n - 1);
                this.score += clearScore;

                // Snapshot occupied target cells BEFORE modifying the board, so the
                // view can animate the clear+shift effect.
                const rowSet = new Set(fullRows);
                const colSet = new Set(fullCols);
                const clearedCells: { col: number; row: number; color: string }[] = [];
                const survivors:    { col: number; row: number; color: string }[] = [];
                for (let r = 0; r < this.board.height; r++) {
                    for (let c = 0; c < this.board.width; c++) {
                        const cell = this.board.getCell(c, r);
                        if (!cell || !cell.isTarget || !cell.occupied || !cell.color) continue;
                        if (rowSet.has(r) || colSet.has(c)) clearedCells.push({ col: c, row: r, color: cell.color });
                        else                                  survivors.push({ col: c, row: r, color: cell.color });
                    }
                }

                for (const row of fullRows) this.board.clearRow(row);
                for (const col of fullCols) this.board.clearCol(col);
                this.board.shiftInward(fullRows, fullCols);

                // Snapshot final occupied target cells so the view can animate the slide
                const finalCells: { col: number; row: number; color: string }[] = [];
                for (let r = 0; r < this.board.height; r++) {
                    for (let c = 0; c < this.board.width; c++) {
                        const cell = this.board.getCell(c, r);
                        if (cell?.isTarget && cell.occupied && cell.color) finalCells.push({ col: c, row: r, color: cell.color });
                    }
                }
                const centerRow = Math.floor(this.board.height / 2);
                const centerCol = Math.floor(this.board.width / 2);

                eventBus.emit(GameEvents.LINES_CLEARED, { rows: fullRows, cols: fullCols, total: n, score: clearScore, clearedCells, survivors, finalCells, centerRow, centerCol });
                eventBus.emit(GameEvents.SCORE_POPUP, { amount: clearScore, type: 'clear' });
                eventBus.emit(GameEvents.SCORE_CHANGED, this.score);
            }

            // Classic is endless — no win condition, just play until spawn is blocked
            this.phase = 'idle';
            return;
        }

        // Normal mode: check win (target filled, no spillage)
        if (this.board.checkTargetFilled() && !this.board.hasSpillage()) {
            this.phase = 'won';
            eventBus.emit(GameEvents.GAME_WON, { score: this.score });
            return;
        }

        // Ready for next piece (scene will call spawnPiece after a brief delay)
        this.phase = 'idle';
    }
}
