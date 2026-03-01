// ---------------------------------------------------------------------------
// JuiceManager — centralizes all visual effects (tweens, shake, particles).
// Exposes methods called by GameScene at the right time in the pipeline.
// ---------------------------------------------------------------------------

import type Phaser from 'phaser';
import {
    PARTICLE_COUNT,
    PARTICLE_LIFESPAN,
    PARTICLE_SPEED_MAX,
    PARTICLE_SPEED_MIN,
    SHAKE_DURATION,
    SHAKE_INTENSITY,
    TWEEN_SETTLE_MS,
    TWEEN_SQUASH_MS,
    TWEEN_STRETCH_MS,
} from '../config/Constants';
import type { BoardView } from './BoardView';

export class JuiceManager {
    private scene: Phaser.Scene;
    private boardView: BoardView;
    private particleTexture: string | null = null;

    constructor(scene: Phaser.Scene, boardView: BoardView) {
        this.scene = scene;
        this.boardView = boardView;
        this.createParticleTexture();
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

    // -----------------------------------------------------------------------
    // Public effects — called by GameScene
    // -----------------------------------------------------------------------

    /** Squash/stretch + shake + particles for each landed cell. */
    playLandEffect(data: { cells: { col: number; row: number }[]; color: string }): void {
        for (let i = 0; i < data.cells.length; i++) {
            const { col, row } = data.cells[i];
            const rect = this.boardView.getCellRect(col, row);
            if (!rect) continue;

            // Use delayedCall for reliable stagger (chain's top-level delay is unreliable)
            const stagger = i * 40;
            this.scene.time.delayedCall(stagger, () => {
                this.scene.tweens.add({
                    targets: rect,
                    scaleX: 1.3,
                    scaleY: 0.7,
                    duration: TWEEN_SQUASH_MS,
                    ease: 'Quad.Out',
                    onComplete: () => {
                        this.scene.tweens.add({
                            targets: rect,
                            scaleX: 0.9,
                            scaleY: 1.15,
                            duration: TWEEN_STRETCH_MS,
                            ease: 'Quad.Out',
                            onComplete: () => {
                                this.scene.tweens.add({
                                    targets: rect,
                                    scaleX: 1,
                                    scaleY: 1,
                                    duration: TWEEN_SETTLE_MS,
                                    ease: 'Bounce.Out',
                                });
                            },
                        });
                    },
                });
            });
        }

        // Screen shake
        this.scene.cameras.main.shake(SHAKE_DURATION, SHAKE_INTENSITY);

        // Particle burst
        this.emitParticles(data.cells, data.color);
    }

    /** Celebration effect for level completion. */
    playWinEffect(): void {
        // Gentle zoom pulse — no flash, no big shake
        this.scene.cameras.main.zoomTo(
            1.15,
            250,
            'Sine.InOut',
            false,
            (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
                if (progress === 1) {
                    this.scene.cameras.main.zoomTo(1, 300, 'Sine.InOut');
                }
            },
        );
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private emitParticles(cells: { col: number; row: number }[], color: string): void {
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

        const tint = Number.parseInt(color.replace('#', ''), 16);

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
        // No event listeners to remove — all calls are explicit now
    }
}
