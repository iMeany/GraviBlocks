// ---------------------------------------------------------------------------
// GameSimulation — orchestrates the model layer.
// Pure TypeScript. Zero Phaser imports.
//
// Owns: BoardModel, PieceSpawner, current piece, score, game phase.
// Communicates outward only through the EventBus.
// ---------------------------------------------------------------------------

import { BoardModel } from './BoardModel';
import { PieceModel } from './PieceModel';
import { PieceSpawner, type Direction, type FallVector } from './PieceSpawner';
import type { LevelConfig } from '../config/LevelConfig';
import { eventBus } from '../events/EventBus';
import { GameEvents } from '../events/GameEvents';

export type GamePhase =
    | 'idle'
    | 'spawning'
    | 'falling'
    | 'landing'
    | 'won'
    | 'game-over';

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
    private levelConfig!: LevelConfig;

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    /** Load a level and reset all state. */
    loadLevel(config: LevelConfig): void {
        this.levelConfig = config;
        this.board = new BoardModel(
            config.boardWidth,
            config.boardHeight,
            config.centerCells,
            config.targetCells,
        );
        this.spawner = new PieceSpawner(config.spawnMode);
        this.currentPiece = null;
        this.phase = 'idle';
        this.score = 0;
        this.piecesLanded = 0;
        eventBus.emit(GameEvents.LEVEL_LOADED, config);
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

        const piece = PieceSpawner.randomPiece();
        const side = this.spawner.nextSide();
        const pos = PieceSpawner.spawnPosition(side, this.board.width, this.board.height);

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
        let dRow = 0;
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
        if (this.phase !== 'falling' || !this.currentPiece) return false;

        let dCol = 0;
        let dRow = 0;
        switch (dir) {
            case 'up':    dRow = -1; break;
            case 'down':  dRow =  1; break;
            case 'left':  dCol = -1; break;
            case 'right': dCol =  1; break;
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
        if (this.phase !== 'falling' || !this.currentPiece) return false;

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

    /** Instantly drop piece to its final position along the fall axis. */
    hardDrop(): void {
        if (this.phase !== 'falling' || !this.currentPiece) return;

        while (this.canPlacePiece(
            this.currentPiece,
            this.pieceCol + this.fallDir.dx,
            this.pieceRow + this.fallDir.dy,
        )) {
            this.pieceCol += this.fallDir.dx;
            this.pieceRow += this.fallDir.dy;
        }

        eventBus.emit(GameEvents.PIECE_MOVED, {
            col: this.pieceCol,
            row: this.pieceRow,
        });
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

        while (this.canPlacePiece(
            this.currentPiece,
            ghostCol + this.fallDir.dx,
            ghostRow + this.fallDir.dy,
        )) {
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
        this.score += 10;

        const landedInfo = {
            cells,
            color: this.currentPiece.color,
            side: this.pieceSide,
        };

        this.currentPiece = null;
        this.phase = 'landing';

        eventBus.emit(GameEvents.PIECE_LANDED, landedInfo);
        eventBus.emit(GameEvents.SCORE_CHANGED, this.score);

        // Check win
        if (this.board.checkTargetFilled()) {
            this.phase = 'won';
            eventBus.emit(GameEvents.GAME_WON, { score: this.score });
            return;
        }

        // Ready for next piece (scene will call spawnPiece after a brief delay)
        this.phase = 'idle';
    }
}
