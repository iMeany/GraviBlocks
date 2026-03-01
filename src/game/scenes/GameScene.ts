// ---------------------------------------------------------------------------
// GameScene — main gameplay scene.
// Owns the GameSimulation (model), views, input manager, and juice.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';
import { GameSimulation } from '../model/GameSimulation';
import { BoardView } from '../view/BoardView';
import { PieceView } from '../view/PieceView';
import { JuiceManager } from '../view/JuiceManager';
import { InputManager, type GameAction } from '../input/InputManager';
import { eventBus } from '../events/EventBus';
import { GameEvents } from '../events/GameEvents';
import { LEVELS } from '../config/LevelConfig';
import { BOARD_PADDING_RATIO, BASE_FALL_INTERVAL } from '../config/Constants';

export class GameScene extends Phaser.Scene {
    private sim!: GameSimulation;
    private boardView!: BoardView;
    private pieceView!: PieceView;
    private juice!: JuiceManager;
    private inputManager!: InputManager;

    private fallTimer = 0;
    private fallInterval = BASE_FALL_INTERVAL;
    private levelIndex = 0;
    private paused = false;

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { levelIndex?: number }): void {
        this.levelIndex = data.levelIndex ?? 0;
        this.paused = false;
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

        // Launch UI overlay scene
        this.scene.launch('UIScene', { levelName: config.name });

        // Spawn the first piece
        this.sim.spawnPiece();
    }

    update(_time: number, delta: number): void {
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

    private onPieceLanded = () => {
        this.pieceView.clear();
        this.boardView.sync();
        this.fallTimer = 0; // reset so there's a brief pause before next piece
    };

    private onGameWon = () => {
        // Show win overlay after a brief delay for juice animations to play
        this.time.delayedCall(1000, () => {
            this.showOverlay('YOU WIN!', '#50e3c2', () => {
                // Next level
                this.cleanUp();
                this.scene.restart({ levelIndex: this.levelIndex + 1 });
            });
        });
    };

    private onGameOver = () => {
        this.time.delayedCall(500, () => {
            this.showOverlay('GAME OVER', '#e94560', () => {
                // Retry same level
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

    private showOverlay(text: string, color: string, onContinue: () => void): void {
        const { width, height } = this.scale;

        // Dim overlay
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
        overlay.setDepth(100);

        const label = this.add.text(width / 2, height * 0.4, text, {
            fontSize: '42px',
            fontFamily: 'monospace',
            color,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(101);

        const btn = this.add.text(width / 2, height * 0.55, '[ CONTINUE ]', {
            fontSize: '22px',
            fontFamily: 'monospace',
            color: '#ffffff',
        }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setColor(color));
        btn.on('pointerout', () => btn.setColor('#ffffff'));
        btn.on('pointerdown', () => {
            overlay.destroy();
            label.destroy();
            btn.destroy();
            onContinue();
        });
    }

    private cleanUp(): void {
        eventBus.off(GameEvents.PIECE_SPAWNED, this.onPieceSpawned);
        eventBus.off(GameEvents.PIECE_MOVED, this.onPieceMoved);
        eventBus.off(GameEvents.PIECE_ROTATED, this.onPieceRotated);
        eventBus.off(GameEvents.PIECE_LANDED, this.onPieceLanded);
        eventBus.off(GameEvents.GAME_WON, this.onGameWon);
        eventBus.off(GameEvents.GAME_OVER, this.onGameOver);
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
