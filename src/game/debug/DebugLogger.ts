// ---------------------------------------------------------------------------
// DebugLogger — hooks into EventBus and logs all game state to browser console.
// Toggle at runtime: DebugLogger.enabled = true/false
// Gives structured, grep-friendly output with [GRAVI] prefix.
// ---------------------------------------------------------------------------

import { eventBus } from '../events/EventBus';
import { GameEvents } from '../events/GameEvents';
import type { GameSimulation } from '../model/GameSimulation';

const TAG = '[GRAVI]';

export class DebugLogger {
    static enabled = true;
    private sim: GameSimulation;

    constructor(sim: GameSimulation) {
        this.sim = sim;
        this.bind();
    }

    private bind(): void {
        eventBus.on(GameEvents.LEVEL_LOADED, this.onLevelLoaded);
        eventBus.on(GameEvents.PIECE_SPAWNED, this.onPieceSpawned);
        eventBus.on(GameEvents.PIECE_MOVED, this.onPieceMoved);
        eventBus.on(GameEvents.PIECE_ROTATED, this.onPieceRotated);
        eventBus.on(GameEvents.PIECE_LANDED, this.onPieceLanded);
        eventBus.on(GameEvents.LINES_CLEARED, this.onLinesCleared);
        eventBus.on(GameEvents.GAME_WON, this.onGameWon);
        eventBus.on(GameEvents.GAME_OVER, this.onGameOver);
        eventBus.on(GameEvents.SCORE_CHANGED, this.onScoreChanged);
    }

    destroy(): void {
        eventBus.off(GameEvents.LEVEL_LOADED, this.onLevelLoaded);
        eventBus.off(GameEvents.PIECE_SPAWNED, this.onPieceSpawned);
        eventBus.off(GameEvents.PIECE_MOVED, this.onPieceMoved);
        eventBus.off(GameEvents.PIECE_ROTATED, this.onPieceRotated);
        eventBus.off(GameEvents.PIECE_LANDED, this.onPieceLanded);
        eventBus.off(GameEvents.LINES_CLEARED, this.onLinesCleared);
        eventBus.off(GameEvents.GAME_WON, this.onGameWon);
        eventBus.off(GameEvents.GAME_OVER, this.onGameOver);
        eventBus.off(GameEvents.SCORE_CHANGED, this.onScoreChanged);
    }

    // -----------------------------------------------------------------------
    // Event handlers
    // -----------------------------------------------------------------------

    private onLevelLoaded = (config: { name: string; boardWidth: number; boardHeight: number; spawnMode: string }) => {
        if (!DebugLogger.enabled) return;
        console.group(
            `${TAG} LEVEL_LOADED — "${config.name}" (${config.boardWidth}×${config.boardHeight}, spawn: ${config.spawnMode})`,
        );
        this.logBoard();
        console.groupEnd();
    };

    private onPieceSpawned = (data: {
        piece: { shapeName: string; color: string };
        col: number;
        row: number;
        side: string;
    }) => {
        if (!DebugLogger.enabled) return;
        console.log(
            `${TAG} PIECE_SPAWNED — shape=${data.piece.shapeName} color=${data.piece.color} pos=(${data.col},${data.row}) side=${data.side} phase=${this.sim.phase}`,
        );
    };

    private onPieceMoved = (data: { col: number; row: number }) => {
        if (!DebugLogger.enabled) return;
        const p = this.sim.currentPiece;
        console.log(
            `${TAG} PIECE_MOVED — pos=(${data.col},${data.row}) shape=${p?.shapeName ?? '?'} fallDir=(${this.sim.fallDir.dx},${this.sim.fallDir.dy})`,
        );
    };

    private onPieceRotated = (data: { col: number; row: number }) => {
        if (!DebugLogger.enabled) return;
        const p = this.sim.currentPiece;
        const offsets = p?.offsets.map((o) => `(${o.dx},${o.dy})`).join(' ') ?? '?';
        console.log(`${TAG} PIECE_ROTATED — pos=(${data.col},${data.row}) offsets=[${offsets}]`);
    };

    private onPieceLanded = (data: { cells: { col: number; row: number }[]; color: string; side: string }) => {
        if (!DebugLogger.enabled) return;
        const cellStr = data.cells.map((c) => `(${c.col},${c.row})`).join(' ');
        const targetFilled = this.countTargetFilled();
        // Note: board state logged here is pre-clear; LINES_CLEARED will log post-clear state
        console.log(
            `${TAG} PIECE_LANDED — side=${data.side} cells=[${cellStr}] landed=${this.sim.piecesLanded} target=${targetFilled.filled}/${targetFilled.total} phase=${this.sim.phase}`,
        );
    };

    private onLinesCleared = (data: { rows: number[]; cols: number[]; total: number; score: number }) => {
        if (!DebugLogger.enabled) return;
        const rStr = data.rows.length ? `rows=[${data.rows.join(',')}]` : '';
        const cStr = data.cols.length ? `cols=[${data.cols.join(',')}]` : '';
        console.group(
            `${TAG} LINES_CLEARED — ${[rStr, cStr].filter(Boolean).join(' ')} total=${data.total} score=+${data.score}`,
        );
        this.logBoard();
        console.groupEnd();
    };

    private onGameWon = (data: { score: number }) => {
        if (!DebugLogger.enabled) return;
        console.log(
            `%c${TAG} 🏆 GAME_WON — score=${data.score} pieces=${this.sim.piecesLanded}`,
            'color: #50e3c2; font-weight: bold; font-size: 14px',
        );
    };

    private onGameOver = (reason: string) => {
        if (!DebugLogger.enabled) return;
        console.log(
            `%c${TAG} ❌ GAME_OVER — reason=${reason} pieces=${this.sim.piecesLanded} score=${this.sim.score}`,
            'color: #e94560; font-weight: bold; font-size: 14px',
        );
        this.logBoard();
    };

    private onScoreChanged = (score: number) => {
        if (!DebugLogger.enabled) return;
        console.log(`${TAG} SCORE_CHANGED — ${score}`);
    };

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private logBoard(): void {
        const ascii = this.sim.board.toAscii();
        console.log(`${TAG} Board state:\n${ascii}`);
    }

    private countTargetFilled(): { filled: number; total: number } {
        let filled = 0;
        let total = 0;
        const b = this.sim.board;
        for (let row = 0; row < b.height; row++) {
            for (let col = 0; col < b.width; col++) {
                const cell = b.getCell(col, row);
                if (cell?.isTarget) {
                    total++;
                    if (cell.occupied) filled++;
                }
            }
        }
        return { filled, total };
    }

    /** Dump full state snapshot to console — callable manually from devtools */
    dumpState(): void {
        const p = this.sim.currentPiece;
        console.group(`${TAG} === STATE DUMP ===`);
        console.log(`phase: ${this.sim.phase}`);
        console.log(`score: ${this.sim.score}`);
        console.log(`piecesLanded: ${this.sim.piecesLanded}`);
        console.log(`pieceSide: ${this.sim.pieceSide}`);
        console.log(`piecePos: (${this.sim.pieceCol}, ${this.sim.pieceRow})`);
        console.log(`fallDir: (${this.sim.fallDir.dx}, ${this.sim.fallDir.dy})`);
        if (p) {
            console.log(`piece: ${p.shapeName} ${p.color}`);
            console.log(`offsets: ${p.offsets.map((o) => `(${o.dx},${o.dy})`).join(' ')}`);
            console.log(
                `absoluteCells: ${p
                    .getAbsoluteCells(this.sim.pieceCol, this.sim.pieceRow)
                    .map((c) => `(${c.col},${c.row})`)
                    .join(' ')}`,
            );
        }
        const tf = this.countTargetFilled();
        console.log(`target: ${tf.filled}/${tf.total}`);
        console.log(`spillage: ${this.sim.board.hasSpillage()}`);
        this.logBoard();
        console.groupEnd();
    }
}
