// ---------------------------------------------------------------------------
// main.ts — Vite entry point. Creates the Phaser.Game instance.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';
import { COLOR_BACKGROUND } from './game/config/Constants';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { MainMenuScene } from './game/scenes/MainMenuScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { UIScene } from './game/scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 960,
    parent: 'game-container',
    backgroundColor: COLOR_BACKGROUND,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene],
};

new Phaser.Game(config);
