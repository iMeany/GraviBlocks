// ---------------------------------------------------------------------------
// BoardView — renders the BoardModel as Phaser GameObjects.
// Reads model state and updates colored rectangles. Never mutates the model.
// ---------------------------------------------------------------------------

import type Phaser from 'phaser';
import { COLOR_CELL_CENTER, COLOR_CELL_EMPTY, COLOR_CELL_TARGET, COLOR_GRID_LINE } from '../config/Constants';
import type { BoardModel } from '../model/BoardModel';

export class BoardView {
    private container: Phaser.GameObjects.Container;
    private cellRects: Phaser.GameObjects.Rectangle[][] = [];
    private gridGraphics: Phaser.GameObjects.Graphics;
    private cellSize: number;
    private board: BoardModel;

    /** Pixel offset so the board container is centered on (0,0) of the container */
    readonly offsetX: number;
    readonly offsetY: number;

    constructor(scene: Phaser.Scene, board: BoardModel, cellSize: number) {
        this.board = board;
        this.cellSize = cellSize;

        // Center the board so (0,0) is the middle of the grid
        this.offsetX = -(board.width * cellSize) / 2;
        this.offsetY = -(board.height * cellSize) / 2;

        this.container = scene.add.container(0, 0);

        // Draw grid lines
        this.gridGraphics = scene.add.graphics();
        this.gridGraphics.lineStyle(1, COLOR_GRID_LINE, 0.3);
        for (let r = 0; r <= board.height; r++) {
            this.gridGraphics.lineBetween(
                this.offsetX,
                this.offsetY + r * cellSize,
                this.offsetX + board.width * cellSize,
                this.offsetY + r * cellSize,
            );
        }
        for (let c = 0; c <= board.width; c++) {
            this.gridGraphics.lineBetween(
                this.offsetX + c * cellSize,
                this.offsetY,
                this.offsetX + c * cellSize,
                this.offsetY + board.height * cellSize,
            );
        }
        this.container.add(this.gridGraphics);

        // Create cell rectangles
        for (let row = 0; row < board.height; row++) {
            const rowRects: Phaser.GameObjects.Rectangle[] = [];
            for (let col = 0; col < board.width; col++) {
                const x = this.offsetX + col * cellSize + cellSize / 2;
                const y = this.offsetY + row * cellSize + cellSize / 2;
                const rect = scene.add.rectangle(x, y, cellSize - 2, cellSize - 2, COLOR_CELL_EMPTY);
                rect.setStrokeStyle(1, COLOR_GRID_LINE, 0.15);
                this.container.add(rect);
                rowRects.push(rect);
            }
            this.cellRects.push(rowRects);
        }

        // Initial sync
        this.sync();
    }

    /** Update all cell visuals to match current board state. */
    sync(): void {
        for (let row = 0; row < this.board.height; row++) {
            for (let col = 0; col < this.board.width; col++) {
                const cell = this.board.getCell(col, row);
                const rect = this.cellRects[row][col];
                if (!cell) continue;

                if (cell.isCenter) {
                    rect.setFillStyle(COLOR_CELL_CENTER);
                } else if (cell.occupied && cell.color) {
                    rect.setFillStyle(this.cssColorToHex(cell.color));
                } else if (cell.isTarget) {
                    rect.setFillStyle(COLOR_CELL_TARGET);
                    rect.setStrokeStyle(1, 0x556677, 0.5);
                } else {
                    rect.setFillStyle(COLOR_CELL_EMPTY);
                    rect.setStrokeStyle(1, COLOR_GRID_LINE, 0.15);
                }
            }
        }
    }

    /** Get the Phaser container (for positioning / camera). */
    getContainer(): Phaser.GameObjects.Container {
        return this.container;
    }

    getCellSize(): number {
        return this.cellSize;
    }

    /** Convert grid col/row to pixel position relative to the container origin. */
    gridToPixel(col: number, row: number): { x: number; y: number } {
        return {
            x: this.offsetX + col * this.cellSize + this.cellSize / 2,
            y: this.offsetY + row * this.cellSize + this.cellSize / 2,
        };
    }

    /** Get the rectangle game object at a specific cell (for tween targets). */
    getCellRect(col: number, row: number): Phaser.GameObjects.Rectangle | null {
        return this.cellRects[row]?.[col] ?? null;
    }

    /** Convert CSS hex color (#rrggbb) to numeric hex. */
    private cssColorToHex(css: string): number {
        return parseInt(css.replace('#', ''), 16);
    }

    destroy(): void {
        this.container.destroy(true);
    }
}
