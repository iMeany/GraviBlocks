// ---------------------------------------------------------------------------
// GameScene — main gameplay scene.
// Owns the GameSimulation (model), views, input manager, and juice.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';
import { BASE_FALL_INTERVAL, BOARD_PADDING_RATIO } from '../config/Constants';
import { LEVELS } from '../config/LevelConfig';
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
    private levelIndex = 0;
    private paused = false;
    private cleaned = false;

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { levelIndex?: number }): void {
        this.levelIndex = data.levelIndex ?? 0;
        this.paused = false;
        this.cleaned = false;
    }

    create(): void {
        const { width, height } = this.scale;

        // Load level config
        const config = LEVELS[this.levelIndex % LEVELS.length];
        this.fallInterval = config.fallInterval;

        // Compute cell size to fit board on screen
        const maxBoardPx = Math.min(width, height) * BOARD_PADDING_RATIO;
        const cellSize = Math.floor(maxBoardPx / Math.max(config.boardWidth, config.boardHeight));

        // Initialize simulation
        this.sim = new GameSimulation();
        this.sim.loadLevel(config);

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

        // Debug tools (toggle HUD with ` key, logs to browser console)
        this.debugLogger = new DebugLogger(this.sim);
        this.debugHUD = new DebugHUD(this, this.sim);
        // Expose to browser devtools: type `__gravi.dumpState()` in console
        (window as unknown as Record<string, unknown>).__gravi = this.debugLogger;

        // Launch UI overlay scene
        this.scene.launch('UIScene', { levelName: config.name });

        // Spawn the first piece
        this.sim.spawnPiece();
    }

    update(_time: number, delta: number): void {
        this.debugHUD.update();

        if (this.paused) return;
        if (this.sim.phase === 'won' || this.sim.phase === 'game-over') return;

        this.inputManager.update();

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
        if (action === 'restart') {
            this.cleanUp();
            this.scene.restart({ levelIndex: this.levelIndex });
            return;
        }
        if (this.paused) return;

        switch (action) {
            case 'move-left':
                this.sim.moveAbsolute('left');
                break;
            case 'move-right':
                this.sim.moveAbsolute('right');
                break;
            case 'move-up':
                this.sim.moveAbsolute('up');
                break;
            case 'move-down':
                this.sim.moveAbsolute('down');
                break;
            case 'rotate-cw':
                this.sim.rotatePiece('CW');
                break;
            case 'rotate-ccw':
                this.sim.rotatePiece('CCW');
                break;
            case 'hard-drop':
                this.sim.hardDrop();
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

    private onPieceSpawned = (data: { piece: unknown; col: number; row: number }) => {
        if (!this.sim.currentPiece) return;
        this.pieceView.show(this.sim.currentPiece, data.col, data.row);
        this.updateGhost();
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

    private onGameWon = () => {
        this.juice.playWinEffect();
        // Wait for zoom pulse, then reset camera and show overlay
        this.time.delayedCall(600, () => {
            this.cameras.main.setZoom(1);
            this.showOverlay('YOU WIN!', '#50e3c2', '[ NEXT LEVEL ]', () => {
                this.cleanUp();
                this.scene.restart({ levelIndex: this.levelIndex + 1 });
            });
        });
    };

    private onGameOver = () => {
        this.time.delayedCall(500, () => {
            this.cameras.main.setZoom(1);
            this.showOverlay('GAME OVER', '#e94560', '[ RETRY ]', () => {
                this.cleanUp();
                this.scene.restart({ levelIndex: this.levelIndex });
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
            this.pieceView.showGhost(this.sim.currentPiece, ghost.col, ghost.row);
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
