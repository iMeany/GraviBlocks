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

        // Mode label
        this.add
            .text(width / 2, height * 0.52, 'SELECT MODE', {
                fontSize: '13px',
                fontFamily: 'monospace',
                color: '#556677',
            })
            .setOrigin(0.5);

        // Helper to make a mode button
        const makeBtn = (label: string, x: number, y: number, mode: 'normal' | 'classic') => {
            const btn = this.add
                .text(x, y, label, {
                    fontSize: '24px',
                    fontFamily: 'monospace',
                    color: '#50e3c2',
                })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            btn.on('pointerover', () => btn.setColor('#ffffff'));
            btn.on('pointerout', () => btn.setColor('#50e3c2'));
            btn.on('pointerdown', () => {
                this.scene.start('GameScene', { levelIndex: 0, mode });
            });
            return btn;
        };

        makeBtn('[ NORMAL ]', width / 2 - 110, height * 0.61, 'normal');
        makeBtn('[ CLASSIC ]', width / 2 + 110, height * 0.61, 'classic');

        // Mode descriptions
        this.add
            .text(width / 2 - 110, height * 0.68, 'Fill the target\nwithout spillage', {
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#445566',
                align: 'center',
            })
            .setOrigin(0.5);

        this.add
            .text(width / 2 + 110, height * 0.68, 'Clear lines,\nscore forever', {
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#445566',
                align: 'center',
            })
            .setOrigin(0.5);

        // Space key starts normal mode
        if (this.input.keyboard) {
            const spaceKey = this.input.keyboard.addKey('SPACE');
            spaceKey.once('down', () => {
                this.scene.start('GameScene', { levelIndex: 0, mode: 'normal' });
            });
        }

        // Controls help
        this.add
            .text(
                width / 2,
                height * 0.84,
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
