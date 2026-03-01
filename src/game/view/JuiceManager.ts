// ---------------------------------------------------------------------------
// JuiceManager — centralizes all visual effects (tweens, shake, particles).
// Subscribes to model events via EventBus. Keeps GameScene clean.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';
import { eventBus } from '../events/EventBus';
import { GameEvents } from '../events/GameEvents';
import { BoardView } from './BoardView';
import {
    SHAKE_DURATION,
    SHAKE_INTENSITY,
    SHAKE_INTENSITY_BIG,
    TWEEN_SQUASH_MS,
    TWEEN_STRETCH_MS,
    TWEEN_SETTLE_MS,
    PARTICLE_LIFESPAN,
    PARTICLE_SPEED_MIN,
    PARTICLE_SPEED_MAX,
    PARTICLE_COUNT,
} from '../config/Constants';

export class JuiceManager {
    private scene: Phaser.Scene;
    private boardView: BoardView;
    private particleTexture: string | null = null;

    constructor(scene: Phaser.Scene, boardView: BoardView) {
        this.scene = scene;
        this.boardView = boardView;

        this.createParticleTexture();
        this.bindEvents();
    }

    // -----------------------------------------------------------------------
    // Setup
    // -----------------------------------------------------------------------

    /** Generate a tiny white square texture for particles (no external assets). */
    private createParticleTexture(): void {
        const key = '__juice_particle';
        if (this.scene.textures.exists(key)) {
            this.particleTexture = key;
            return;
        }
        const g = this.scene.add.graphics();
        g.fillStyle(0xffffff);
        g.fillRect(0, 0, 6, 6);
        g.generateTexture(key, 6, 6);
        g.destroy();
        this.particleTexture = key;
    }

    private bindEvents(): void {
        eventBus.on(GameEvents.PIECE_LANDED, this.onPieceLanded);
        eventBus.on(GameEvents.GAME_WON, this.onGameWon);
    }

    // -----------------------------------------------------------------------
    // Effects
    // -----------------------------------------------------------------------

    private onPieceLanded = (data: {
        cells: { col: number; row: number }[];
        color: string;
    }) => {
        // Squash / stretch each landed cell
        for (let i = 0; i < data.cells.length; i++) {
            const { col, row } = data.cells[i];
            const rect = this.boardView.getCellRect(col, row);
            if (!rect) continue;

            this.scene.tweens.chain({
                targets: rect,
                tweens: [
                    { scaleX: 1.3, scaleY: 0.7, duration: TWEEN_SQUASH_MS, ease: 'Quad.Out' },
                    { scaleX: 0.9, scaleY: 1.15, duration: TWEEN_STRETCH_MS, ease: 'Quad.Out' },
                    { scaleX: 1, scaleY: 1, duration: TWEEN_SETTLE_MS, ease: 'Bounce.Out' },
                ],
                delay: i * 30, // stagger
            });
        }

        // Screen shake
        this.scene.cameras.main.shake(SHAKE_DURATION, SHAKE_INTENSITY);

        // Particle burst at the center of the landed cells
        this.emitParticles(data.cells, data.color);
    };

    private onGameWon = () => {
        // Big shake
        this.scene.cameras.main.shake(200, SHAKE_INTENSITY_BIG);

        // Flash
        this.scene.cameras.main.flash(400, 255, 255, 255);

        // Camera zoom pulse
        this.scene.cameras.main.zoomTo(1.3, 300, 'Sine.InOut', false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
            if (progress === 1) {
                this.scene.cameras.main.zoomTo(1, 200, 'Sine.InOut');
            }
        });
    };

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private emitParticles(
        cells: { col: number; row: number }[],
        color: string,
    ): void {
        if (!this.particleTexture) return;

        // Average position of the landed cells
        let sumX = 0;
        let sumY = 0;
        for (const { col, row } of cells) {
            const p = this.boardView.gridToPixel(col, row);
            sumX += p.x;
            sumY += p.y;
        }
        const cx = sumX / cells.length;
        const cy = sumY / cells.length;

        // Convert to world coordinates (container offset)
        const container = this.boardView.getContainer();
        const worldX = container.x + cx;
        const worldY = container.y + cy;

        const tint = parseInt(color.replace('#', ''), 16);

        const emitter = this.scene.add.particles(worldX, worldY, this.particleTexture, {
            speed: { min: PARTICLE_SPEED_MIN, max: PARTICLE_SPEED_MAX },
            scale: { start: 0.8, end: 0 },
            lifespan: PARTICLE_LIFESPAN,
            quantity: PARTICLE_COUNT,
            frequency: -1, // explode mode
            tint: tint,
            angle: { min: 0, max: 360 },
        });

        emitter.explode(PARTICLE_COUNT, worldX, worldY);

        // Auto-destroy after particles have died
        this.scene.time.delayedCall(PARTICLE_LIFESPAN + 100, () => {
            emitter.destroy();
        });
    }

    /** Play a quick scale pop on a game object (e.g., on rotate). */
    scalePop(target: Phaser.GameObjects.GameObject): void {
        this.scene.tweens.add({
            targets: target,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 50,
            yoyo: true,
            ease: 'Quad.Out',
        });
    }

    destroy(): void {
        eventBus.off(GameEvents.PIECE_LANDED, this.onPieceLanded);
        eventBus.off(GameEvents.GAME_WON, this.onGameWon);
    }
}
