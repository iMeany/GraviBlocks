// ---------------------------------------------------------------------------
// UIScene — HUD overlay that runs in parallel with GameScene.
// Displays score, level name, and game state.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';
import { eventBus } from '../events/EventBus';
import { GameEvents } from '../events/GameEvents';

export class UIScene extends Phaser.Scene {
    private scoreText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private pauseText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'UIScene' });
    }

    init(data: { levelName?: string }): void {
        this._levelName = data.levelName ?? '';
    }

    private _levelName = '';

    create(): void {
        const pad = 16;

        // Score (top-left)
        this.scoreText = this.add.text(pad, pad, 'Score: 0', {
            fontSize: '18px',
            fontFamily: 'monospace',
            color: '#ffffff',
        });

        // Level name (top-right)
        this.levelText = this.add
            .text(this.scale.width - pad, pad, this._levelName, {
                fontSize: '14px',
                fontFamily: 'monospace',
                color: '#888899',
            })
            .setOrigin(1, 0);

        // Pause indicator (center)
        this.pauseText = this.add
            .text(this.scale.width / 2, this.scale.height / 2, 'PAUSED', {
                fontSize: '32px',
                fontFamily: 'monospace',
                color: '#ffffff',
                fontStyle: 'bold',
            })
            .setOrigin(0.5)
            .setAlpha(0);

        // Listen for events
        eventBus.on(GameEvents.SCORE_CHANGED, this.onScoreChanged);
        eventBus.on(GameEvents.LEVEL_LOADED, this.onLevelLoaded);
        eventBus.on('game-paused', this.onPaused);
        eventBus.on('game-resumed', this.onResumed);
    }

    private onScoreChanged = (score: unknown) => {
        this.scoreText.setText(`Score: ${score}`);
    };

    private onLevelLoaded = (config: { name: string }) => {
        this.levelText.setText(config.name);
    };

    private onPaused = () => {
        this.pauseText.setAlpha(1);
    };

    private onResumed = () => {
        this.pauseText.setAlpha(0);
    };

    shutdown(): void {
        eventBus.off(GameEvents.SCORE_CHANGED, this.onScoreChanged);
        eventBus.off(GameEvents.LEVEL_LOADED, this.onLevelLoaded);
        eventBus.off('game-paused', this.onPaused);
        eventBus.off('game-resumed', this.onResumed);
    }
}
