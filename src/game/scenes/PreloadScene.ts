// ---------------------------------------------------------------------------
// PreloadScene — loads assets and shows a minimal loading bar.
// For MVP we have no external assets (programmer art), so this is fast.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload(): void {
        // Show a loading bar (useful once we add real assets)
        const { width, height } = this.scale;
        const barW = width * 0.5;
        const barH = 8;
        const barX = (width - barW) / 2;
        const barY = height / 2;

        const bg = this.add.rectangle(barX + barW / 2, barY, barW, barH, 0x222244);
        const fill = this.add.rectangle(barX + 2, barY, 0, barH - 4, 0x50e3c2);
        fill.setOrigin(0, 0.5);

        this.load.on('progress', (value: number) => {
            fill.width = (barW - 4) * value;
        });

        // ---------- load assets here when we have them ----------
        // this.load.image('block', 'assets/block.png');
        // this.load.audio('land', 'assets/land.mp3');

        // Generate a placeholder texture so particle emitters work
        if (!this.textures.exists('__juice_particle')) {
            const g = this.add.graphics();
            g.fillStyle(0xffffff);
            g.fillRect(0, 0, 6, 6);
            g.generateTexture('__juice_particle', 6, 6);
            g.destroy();
        }

        bg.destroy(); // clean up after load
    }

    create(): void {
        this.scene.start('MainMenuScene');
    }
}
