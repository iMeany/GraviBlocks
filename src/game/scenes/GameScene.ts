// ---------------------------------------------------------------------------
// GameScene — main gameplay scene.
// Owns the GameSimulation (model), views, input manager, and juice.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';
import { BASE_FALL_INTERVAL, BOARD_PADDING_RATIO, COLOR_SIDE_ACTIVE, COLOR_SIDE_INACTIVE, LOCK_DELAY_MS, SIDE_INDICATOR_H } from '../config/Constants';
import { CLASSIC_CONFIG, LEVELS } from '../config/LevelConfig';
import type { GameMode } from '../config/LevelConfig';
import { DebugHUD } from '../debug/DebugHUD';
import { DebugLogger } from '../debug/DebugLogger';
import { eventBus } from '../events/EventBus';
import { GameEvents } from '../events/GameEvents';
import { type GameAction, InputManager } from '../input/InputManager';
import { GameSimulation } from '../model/GameSimulation';
import { BoardView } from '../view/BoardView';
import { JuiceManager } from '../view/JuiceManager';
import { PieceView } from '../view/PieceView';

export class GameScene extends Phaser.Scene {
    private sim!: GameSimulation;
    private boardView!: BoardView;
    private pieceView!: PieceView;
    private juice!: JuiceManager;
    private inputManager!: InputManager;
    private debugLogger!: DebugLogger;
    private debugHUD!: DebugHUD;

    private fallTimer = 0;
    private fallInterval = BASE_FALL_INTERVAL;
    /** Counts down after hard-drop; when it reaches 0 the piece is committed. -1 = inactive. */
    private lockDelayTimer = -1;
    private levelIndex = 0;
    private mode: GameMode = 'normal';
    private paused = false;
    private cleaned = false;

    /** Side indicator bars (top / right / bottom / left) */
    private sideIndicators: Phaser.GameObjects.Rectangle[] = [];

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { levelIndex?: number; mode?: GameMode }): void {
        this.levelIndex = data.levelIndex ?? 0;
        this.mode = data.mode ?? 'normal';
        this.paused = false;
        this.cleaned = false;
    }

    create(): void {
        const { width, height } = this.scale;

        // Load level config (classic mode uses its own fixed config)
        const config = this.mode === 'classic'
            ? CLASSIC_CONFIG
            : LEVELS[this.levelIndex % LEVELS.length];
        this.fallInterval = config.fallInterval;

        // Compute cell size to fit board on screen
        const maxBoardPx = Math.min(width, height) * BOARD_PADDING_RATIO;
        const cellSize = Math.floor(maxBoardPx / Math.max(config.boardWidth, config.boardHeight));

        // Initialize simulation
        this.sim = new GameSimulation();
        this.sim.loadLevel(config, this.mode);

        // Initialize views
        this.boardView = new BoardView(this, this.sim.board, cellSize);
        this.boardView.getContainer().setPosition(width / 2, height / 2);

        this.pieceView = new PieceView(this, this.boardView);
        this.juice = new JuiceManager(this, this.boardView);

        // Initialize input
        this.inputManager = new InputManager(this);
        this.inputManager.onAction(this.handleAction.bind(this));

        // Listen for model events to update views
        eventBus.on(GameEvents.PIECE_SPAWNED, this.onPieceSpawned);
        eventBus.on(GameEvents.PIECE_MOVED, this.onPieceMoved);
        eventBus.on(GameEvents.PIECE_ROTATED, this.onPieceRotated);
        eventBus.on(GameEvents.PIECE_LANDED, this.onPieceLanded);
        eventBus.on(GameEvents.GAME_WON, this.onGameWon);
        eventBus.on(GameEvents.GAME_OVER, this.onGameOver);
        eventBus.on(GameEvents.LINES_CLEARED, this.onLinesCleared);
        eventBus.on(GameEvents.SCORE_POPUP, this.onScorePopup);

        // Build side-spawn indicators (thin bars at screen edge, scroll-factor 0)
        const indicatorData: [number, number, number, number][] = [
            // x, y, w, h
            [width / 2, SIDE_INDICATOR_H / 2, width, SIDE_INDICATOR_H],          // top
            [width - SIDE_INDICATOR_H / 2, height / 2, SIDE_INDICATOR_H, height], // right
            [width / 2, height - SIDE_INDICATOR_H / 2, width, SIDE_INDICATOR_H], // bottom
            [SIDE_INDICATOR_H / 2, height / 2, SIDE_INDICATOR_H, height],         // left
        ];
        this.sideIndicators = indicatorData.map(([x, y, w, h]) => {
            const r = this.add.rectangle(x, y, w, h, COLOR_SIDE_INACTIVE);
            r.setScrollFactor(0).setDepth(50).setAlpha(0.7);
            return r;
        });

        // Debug tools (toggle HUD with ` key, logs to browser console)
        this.debugLogger = new DebugLogger(this.sim);
        this.debugHUD = new DebugHUD(this, this.sim);
        // Expose to browser devtools: type `__gravi.dumpState()` in console
        (window as unknown as Record<string, unknown>).__gravi = this.debugLogger;

        // Launch UI overlay scene
        this.scene.launch('UIScene', { levelName: config.name, mode: this.mode });

        // Spawn the first piece
        this.sim.spawnPiece();
    }

    update(_time: number, delta: number): void {
        this.debugHUD.update();

        if (this.paused) return;
        if (this.sim.phase === 'won' || this.sim.phase === 'game-over') return;

        this.inputManager.update();

        // Lock-delay countdown after hard drop
        if (this.sim.phase === 'lock-delay') {
            this.lockDelayTimer -= delta;
            if (this.lockDelayTimer <= 0) {
                this.lockDelayTimer = -1;
                this.sim.commitLand();
            }
            return; // skip auto-fall during grace period
        }

        // Automatic fall on timer
        this.fallTimer += delta;
        if (this.fallTimer >= this.fallInterval) {
            this.fallTimer = 0;
            if (this.sim.phase === 'falling') {
                this.sim.tick();
            } else if (this.sim.phase === 'idle') {
                this.sim.spawnPiece();
            }
        }
    }

    // -----------------------------------------------------------------------
    // Input handling
    // -----------------------------------------------------------------------

    private handleAction(action: GameAction): void {
        if (action === 'pause') {
            this.togglePause();
            return;
        }
        if (action === 'quit') {
            this.cleanUp();
            this.scene.start('MainMenuScene');
            return;
        }
        if (action === 'restart') {
            this.cleanUp();
            this.scene.restart({ levelIndex: this.levelIndex, mode: this.mode });
            return;
        }
        if (this.paused) return;

        // Helper: does this move action align with the current fall direction?
        const isSoftDrop = (a: GameAction): boolean => {
            const fd = this.sim.fallDir;
            return (
                (a === 'move-down'  && fd.dy > 0) ||
                (a === 'move-up'    && fd.dy < 0) ||
                (a === 'move-right' && fd.dx > 0) ||
                (a === 'move-left'  && fd.dx < 0)
            );
        };

        switch (action) {
            case 'move-left':
            case 'move-right':
            case 'move-up':
            case 'move-down': {
                const dir = action.replace('move-', '') as 'left' | 'right' | 'up' | 'down';
                if (isSoftDrop(action) && this.sim.phase === 'falling') {
                    // Soft drop: advance one step in fall direction and reset timer
                    this.sim.tick();
                    this.fallTimer = 0;
                } else {
                    this.sim.moveAbsolute(dir);
                }
                break;
            }
            case 'rotate-cw':
                this.sim.rotatePiece('CW');
                break;
            case 'rotate-ccw':
                this.sim.rotatePiece('CCW');
                break;
            case 'hard-drop':
                if (this.sim.phase === 'falling') {
                    this.sim.hardDrop();
                    this.lockDelayTimer = LOCK_DELAY_MS;
                    this.fallTimer = 0;
                }
                break;
        }
    }

    private togglePause(): void {
        this.paused = !this.paused;
        eventBus.emit(this.paused ? 'game-paused' : 'game-resumed');
    }

    // -----------------------------------------------------------------------
    // Event handlers
    // -----------------------------------------------------------------------

    private onPieceSpawned = (data: { piece: unknown; col: number; row: number; side: import('../model/PieceSpawner').Direction }) => {
        if (!this.sim.currentPiece) return;
        this.pieceView.show(this.sim.currentPiece, data.col, data.row);
        this.updateGhost();

        // Light up the active side indicator, dim others
        const sideOrder: import('../model/PieceSpawner').Direction[] = ['top', 'right', 'bottom', 'left'];
        this.sideIndicators.forEach((bar, i) => {
            const isActive = sideOrder[i] === data.side;
            bar.setFillStyle(isActive ? COLOR_SIDE_ACTIVE : COLOR_SIDE_INACTIVE);
            bar.setAlpha(isActive ? 1 : 0.4);
        });
    };

    private onPieceMoved = (_data: { col: number; row: number }) => {
        if (!this.sim.currentPiece) return;
        this.pieceView.updatePosition(this.sim.currentPiece, this.sim.pieceCol, this.sim.pieceRow);
        this.updateGhost();
    };

    private onPieceRotated = (_data: { col: number; row: number }) => {
        if (!this.sim.currentPiece) return;
        this.pieceView.snapToPosition(this.sim.currentPiece, this.sim.pieceCol, this.sim.pieceRow);
        this.updateGhost();
    };

    private onPieceLanded = (data: { cells: { col: number; row: number }[]; color: string }) => {
        this.pieceView.clear();
        // Sync board colors FIRST so tween targets have correct fill
        this.boardView.sync();
        // Then play squash/stretch on all landed cells
        this.juice.playLandEffect(data);
        this.fallTimer = 0; // reset so there's a brief pause before next piece
    };

    private onLinesCleared = (data: {
        rows: number[]; cols: number[]; total: number; score: number;
        clearedCells: { col: number; row: number; color: string }[];
        survivors:    { col: number; row: number; color: string }[];
        finalCells:   { col: number; row: number; color: string }[];
        centerRow: number; centerCol: number;
    }) => {
        // JuiceManager handles boardView.sync() internally before building overlays
        this.juice.playLineClearEffect(data);
        const intensity = 0.006 * data.total;
        this.cameras.main.shake(120, intensity);
    };

    private onScorePopup = (data: { amount: number; type: 'land' | 'clear' }) => {
        const { width, height } = this.scale;
        const color = data.type === 'clear' ? '#50e3c2' : '#f8e71c';
        const label = data.type === 'clear'
            ? `+${data.amount} CLEAR!`
            : `+${data.amount}`;

        const t = this.add
            .text(width / 2, height / 2 - 40, label, {
                fontSize: data.type === 'clear' ? '22px' : '16px',
                fontFamily: 'monospace',
                color,
                fontStyle: 'bold',
            })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(60);

        this.tweens.add({
            targets: t,
            y: t.y - 55,
            alpha: 0,
            duration: 900,
            ease: 'Sine.Out',
            onComplete: () => t.destroy(),
        });
    };

    private onGameWon = () => {
        this.juice.playWinEffect();
        // Wait for zoom pulse, then reset camera and show overlay
        this.time.delayedCall(600, () => {
            this.cameras.main.setZoom(1);
            this.showOverlay('YOU WIN!', '#50e3c2', '[ NEXT LEVEL ]', () => {
                this.cleanUp();
                this.scene.restart({ levelIndex: this.levelIndex + 1, mode: this.mode });
            });
        });
    };

    private onGameOver = () => {
        this.time.delayedCall(500, () => {
            this.cameras.main.setZoom(1);
            this.showOverlay('GAME OVER', '#e94560', '[ RETRY ]', () => {
                this.cleanUp();
                this.scene.restart({ levelIndex: this.levelIndex, mode: this.mode });
            });
        });
    };

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private updateGhost(): void {
        if (!this.sim.currentPiece) return;
        const ghost = this.sim.getGhostPosition();
        if (ghost) {
            this.pieceView.showGhost(this.sim.currentPiece, ghost.col, ghost.row, ghost.danger);
        }
    }

    private showOverlay(text: string, color: string, buttonLabel: string, onContinue: () => void): void {
        const { width, height } = this.scale;
        let acted = false;

        // Dim overlay — all objects are scroll-factor 0 so camera zoom can't displace them
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
        overlay.setDepth(100).setScrollFactor(0);

        const label = this.add
            .text(width / 2, height * 0.4, text, {
                fontSize: '42px',
                fontFamily: 'monospace',
                color,
                fontStyle: 'bold',
            })
            .setOrigin(0.5)
            .setDepth(101)
            .setScrollFactor(0);

        const btn = this.add
            .text(width / 2, height * 0.55, buttonLabel, {
                fontSize: '22px',
                fontFamily: 'monospace',
                color: '#ffffff',
            })
            .setOrigin(0.5)
            .setDepth(101)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        const hint = this.add
            .text(width / 2, height * 0.62, 'Press SPACE or click', {
                fontSize: '13px',
                fontFamily: 'monospace',
                color: '#556677',
            })
            .setOrigin(0.5)
            .setDepth(101)
            .setScrollFactor(0);

        const doAction = () => {
            if (acted) return; // prevent double-fire
            acted = true;
            overlay.destroy();
            label.destroy();
            btn.destroy();
            hint.destroy();
            onContinue();
        };

        btn.on('pointerover', () => btn.setColor(color));
        btn.on('pointerout', () => btn.setColor('#ffffff'));
        btn.on('pointerdown', doAction);

        // Also continue on any key press (SPACE, Enter, etc.)
        if (this.input.keyboard) {
            this.input.keyboard.once('keydown', doAction);
        }
    }

    private cleanUp(): void {
        if (this.cleaned) return; // guard against double cleanup
        this.cleaned = true;

        // Reset camera state for next scene
        this.cameras.main.setZoom(1);
        this.cameras.main.resetFX();

        eventBus.off(GameEvents.PIECE_SPAWNED, this.onPieceSpawned);
        eventBus.off(GameEvents.PIECE_MOVED, this.onPieceMoved);
        eventBus.off(GameEvents.PIECE_ROTATED, this.onPieceRotated);
        eventBus.off(GameEvents.PIECE_LANDED, this.onPieceLanded);
        eventBus.off(GameEvents.GAME_WON, this.onGameWon);
        eventBus.off(GameEvents.GAME_OVER, this.onGameOver);
        eventBus.off(GameEvents.LINES_CLEARED, this.onLinesCleared);
        eventBus.off(GameEvents.SCORE_POPUP, this.onScorePopup);
        this.debugLogger.destroy();
        this.debugHUD.destroy();
        this.juice.destroy();
        this.boardView.destroy();
        this.pieceView.destroy();
        this.inputManager.destroy();
        this.scene.stop('UIScene');
    }

    shutdown(): void {
        this.cleanUp();
    }
}
