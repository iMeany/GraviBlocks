// ---------------------------------------------------------------------------
// PieceView — renders the currently falling piece + ghost piece.
// Creates Phaser Rectangles that follow the model piece position.
// ---------------------------------------------------------------------------

import type Phaser from 'phaser';
import { COLOR_CELL_GHOST, TWEEN_MOVE_MS } from '../config/Constants';
import type { PieceModel } from '../model/PieceModel';
import type { BoardView } from './BoardView';

export class PieceView {
    private scene: Phaser.Scene;
    private boardView: BoardView;
    private blocks: Phaser.GameObjects.Rectangle[] = [];
    private ghostBlocks: Phaser.GameObjects.Rectangle[] = [];
    private container: Phaser.GameObjects.Container;

    constructor(scene: Phaser.Scene, boardView: BoardView) {
        this.scene = scene;
        this.boardView = boardView;
        this.container = boardView.getContainer();
    }

    /**
     * Show a piece at a grid position. Creates new block rectangles.
     */
    show(piece: PieceModel, col: number, row: number): void {
        this.clear();
        const cellSize = this.boardView.getCellSize();
        const color = this.cssColorToHex(piece.color);

        for (const offset of piece.offsets) {
            const pos = this.boardView.gridToPixel(col + offset.dx, row + offset.dy);
            const rect = this.scene.add.rectangle(pos.x, pos.y, cellSize - 2, cellSize - 2, color);
            rect.setStrokeStyle(2, 0xffffff, 0.3);
            this.container.add(rect);
            this.blocks.push(rect);
        }
    }

    /**
     * Update piece position with a smooth tween.
     */
    updatePosition(piece: PieceModel, col: number, row: number): void {
        piece.offsets.forEach((offset, i) => {
            const block = this.blocks[i];
            if (!block) return;
            const target = this.boardView.gridToPixel(col + offset.dx, row + offset.dy);
            this.scene.tweens.add({
                targets: block,
                x: target.x,
                y: target.y,
                duration: TWEEN_MOVE_MS,
                ease: 'Sine.Out',
            });
        });
    }

    /**
     * Snap piece to position instantly (no tween). Used after rotation.
     */
    snapToPosition(piece: PieceModel, col: number, row: number): void {
        piece.offsets.forEach((offset, i) => {
            const block = this.blocks[i];
            if (!block) return;
            const pos = this.boardView.gridToPixel(col + offset.dx, row + offset.dy);
            block.x = pos.x;
            block.y = pos.y;
        });
    }

    /**
     * Show ghost piece at the hard-drop destination.
     */
    showGhost(piece: PieceModel, col: number, row: number): void {
        this.clearGhost();
        const cellSize = this.boardView.getCellSize();

        for (const offset of piece.offsets) {
            const pos = this.boardView.gridToPixel(col + offset.dx, row + offset.dy);
            const rect = this.scene.add.rectangle(
                pos.x,
                pos.y,
                cellSize - 2,
                cellSize - 2,
                COLOR_CELL_GHOST,
                0, // fillColor, fillAlpha
            );
            rect.setStrokeStyle(1, COLOR_CELL_GHOST, 0.25);
            rect.setAlpha(0.2);
            this.container.add(rect);
            this.ghostBlocks.push(rect);
        }
    }

    clear(): void {
        for (const b of this.blocks) b.destroy();
        this.blocks = [];
        this.clearGhost();
    }

    clearGhost(): void {
        for (const b of this.ghostBlocks) b.destroy();
        this.ghostBlocks = [];
    }

    /** Get the block rectangles (for juice manager to animate on landing). */
    getBlocks(): Phaser.GameObjects.Rectangle[] {
        return [...this.blocks];
    }

    private cssColorToHex(css: string): number {
        return parseInt(css.replace('#', ''), 16);
    }

    destroy(): void {
        this.clear();
    }
}
