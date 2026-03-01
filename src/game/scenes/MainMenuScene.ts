// ---------------------------------------------------------------------------
// MainMenuScene — title screen with a play button.
// Simple text-based for MVP.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }

    create(): void {
        const { width, height } = this.scale;

        // Title
        const title = this.add
            .text(width / 2, height * 0.3, 'GRAVIBLOCKS', {
                fontSize: '48px',
                fontFamily: 'monospace',
                color: '#e94560',
                fontStyle: 'bold',
            })
            .setOrigin(0.5);

        // Subtle pulse animation on the title
        this.tweens.add({
            targets: title,
            scaleX: 1.05,
            scaleY: 1.05,
            yoyo: true,
            repeat: -1,
            duration: 800,
            ease: 'Sine.InOut',
        });

        // Subtitle
        this.add
            .text(width / 2, height * 0.42, 'Blocks fall from every direction', {
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#888899',
            })
            .setOrigin(0.5);

        // Play button
        const playBtn = this.add
            .text(width / 2, height * 0.6, '[ PLAY ]', {
                fontSize: '28px',
                fontFamily: 'monospace',
                color: '#50e3c2',
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        playBtn.on('pointerover', () => playBtn.setColor('#ffffff'));
        playBtn.on('pointerout', () => playBtn.setColor('#50e3c2'));
        playBtn.on('pointerdown', () => {
            this.scene.start('GameScene', { levelIndex: 0 });
        });

        // Space key also starts the game
        if (this.input.keyboard) {
            const spaceKey = this.input.keyboard.addKey('SPACE');
            spaceKey.once('down', () => {
                this.scene.start('GameScene', { levelIndex: 0 });
            });
        }

        // Controls help
        this.add
            .text(
                width / 2,
                height * 0.78,
                ['Arrow Keys — Move', 'Z / X — Rotate', 'Space — Hard Drop', 'P — Pause'].join('\n'),
                {
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    color: '#556677',
                    align: 'center',
                },
            )
            .setOrigin(0.5);
    }
}
