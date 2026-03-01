// ---------------------------------------------------------------------------
// UIScene — HUD overlay that runs in parallel with GameScene.
// Displays score, mode badge, lines cleared, next-piece preview, and paused.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';
import { eventBus } from '../events/EventBus';
import { GameEvents } from '../events/GameEvents';
import type { PieceModel } from '../model/PieceModel';
import type { GameMode } from '../config/LevelConfig';

const PREVIEW_CELL = 14; // px per cell in the next-piece panel
const PANEL_W      = 90;
const PANEL_H      = 72;

export class UIScene extends Phaser.Scene {
    private scoreText!: Phaser.GameObjects.Text;
    private linesText!: Phaser.GameObjects.Text;
    private pauseText!: Phaser.GameObjects.Text;
    private nextBlocks: Phaser.GameObjects.Rectangle[] = [];
    private mode: GameMode = 'normal';
    private linesCleared = 0;

    constructor() {
        super({ key: 'UIScene' });
    }

    init(data: { levelName?: string; mode?: GameMode }): void {
        this._levelName = data.levelName ?? '';
        this.mode = data.mode ?? 'normal';
        this.linesCleared = 0;
    }

    private _levelName = '';

    create(): void {
        const { width, height } = this.scale;
        const pad = 14;

        // Mode badge (top-centre)
        const modeLabel = this.mode === 'classic' ? 'CLASSIC' : 'NORMAL';
        const modeColor = this.mode === 'classic' ? '#50e3c2' : '#e94560';
        this.add
            .text(width / 2, pad, `${modeLabel} — ${this._levelName}`, {
                fontSize: '13px',
                fontFamily: 'monospace',
                color: modeColor,
                alpha: 0.8,
            } as Phaser.Types.GameObjects.Text.TextStyle)
            .setOrigin(0.5, 0);

        // Score (top-left)
        this.scoreText = this.add.text(pad, pad, 'SCORE\n0', {
            fontSize: '16px',
            fontFamily: 'monospace',
            color: '#ffffff',
            lineSpacing: 2,
        } as Phaser.Types.GameObjects.Text.TextStyle);

        // Lines cleared (classic only, top-left below score)
        this.linesText = this.add.text(pad, pad + 50, 'LINES\n0', {
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#50e3c2',
            lineSpacing: 2,
            alpha: this.mode === 'classic' ? 1 : 0,
        } as Phaser.Types.GameObjects.Text.TextStyle);

        // Next piece (top-right)
        const panelX = width - pad - PANEL_W;
        const panelY = pad;

        this.add.rectangle(panelX + PANEL_W / 2, panelY + PANEL_H / 2, PANEL_W, PANEL_H, 0x0f1a2e)
            .setStrokeStyle(1, 0x334455, 1);

        this.add.text(panelX + PANEL_W / 2, panelY + 6, 'NEXT', {
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#556677',
        } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);

        // Pause indicator (centre)
        this.pauseText = this.add
            .text(width / 2, height / 2, 'PAUSED', {
                fontSize: '32px',
                fontFamily: 'monospace',
                color: '#ffffff',
                fontStyle: 'bold',
            })
            .setOrigin(0.5)
            .setAlpha(0);

        // Event subscriptions
        eventBus.on(GameEvents.SCORE_CHANGED,      this.onScoreChanged);
        eventBus.on(GameEvents.LINES_CLEARED,      this.onLinesCleared);
        eventBus.on(GameEvents.NEXT_PIECE_CHANGED,  this.onNextPieceChanged);
        eventBus.on('game-paused',                  this.onPaused);
        eventBus.on('game-resumed',                 this.onResumed);
    }

    // Private helpers

    private drawNextPiece(piece: PieceModel): void {
        // Destroy old preview blocks
        for (const b of this.nextBlocks) b.destroy();
        this.nextBlocks = [];

        const { width } = this.scale;
        const pad = 14;
        const panelX = width - pad - PANEL_W;
        const panelY = pad;
        // Centre of preview area
        const cx = panelX + PANEL_W / 2;
        const cy = panelY + PANEL_H / 2 + 6; // shift slightly down for NEXT label

        const color = parseInt(piece.color.replace('#', ''), 16);

        for (const o of piece.offsets) {
            const bx = cx + o.dx * PREVIEW_CELL;
            const by = cy + o.dy * PREVIEW_CELL;
            const r = this.add.rectangle(bx, by, PREVIEW_CELL - 2, PREVIEW_CELL - 2, color);
            r.setStrokeStyle(1, 0xffffff, 0.2);
            this.nextBlocks.push(r);
        }
    }

    // Event handlers

    private onScoreChanged = (score: unknown) => {
        this.scoreText.setText(`SCORE\n${score}`);
    };

    private onLinesCleared = (data: { total: number }) => {
        this.linesCleared += data.total;
        this.linesText.setText(`LINES\n${this.linesCleared}`);

        // Brief flash tween on the lines counter
        this.tweens.add({
            targets: this.linesText,
            scaleX: 1.2, scaleY: 1.2,
            yoyo: true,
            duration: 80,
        });
    };

    private onNextPieceChanged = (piece: PieceModel) => {
        this.drawNextPiece(piece);
    };

    private onPaused = () => {
        this.pauseText.setAlpha(1);
    };

    private onResumed = () => {
        this.pauseText.setAlpha(0);
    };

    shutdown(): void {
        eventBus.off(GameEvents.SCORE_CHANGED,     this.onScoreChanged);
        eventBus.off(GameEvents.LINES_CLEARED,     this.onLinesCleared);
        eventBus.off(GameEvents.NEXT_PIECE_CHANGED, this.onNextPieceChanged);
        eventBus.off('game-paused',                this.onPaused);
        eventBus.off('game-resumed',               this.onResumed);
    }
}
