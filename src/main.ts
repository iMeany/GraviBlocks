// ---------------------------------------------------------------------------
// main.ts — Vite entry point. Creates the Phaser.Game instance.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { MainMenuScene } from './game/scenes/MainMenuScene';
import { GameScene } from './game/scenes/GameScene';
import { UIScene } from './game/scenes/UIScene';
import { COLOR_BACKGROUND } from './game/config/Constants';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: COLOR_BACKGROUND,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene],
};

new Phaser.Game(config);
