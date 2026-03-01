// ---------------------------------------------------------------------------
// InputManager — abstracts keyboard + touch into game actions.
// Uses rate-limited key checking for smooth grid movement.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';
import { INPUT_REPEAT_RATE } from '../config/Constants';

export type GameAction =
    | 'move-left'
    | 'move-right'
    | 'move-up'
    | 'move-down'
    | 'rotate-cw'
    | 'rotate-ccw'
    | 'hard-drop'
    | 'pause';

export class InputManager {
    private scene: Phaser.Scene;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyZ!: Phaser.Input.Keyboard.Key;
    private keyX!: Phaser.Input.Keyboard.Key;
    private keySpace!: Phaser.Input.Keyboard.Key;
    private keyP!: Phaser.Input.Keyboard.Key;

    /** Callbacks registered by the scene */
    private actionListeners: ((action: GameAction) => void)[] = [];

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        if (scene.input.keyboard) {
            this.cursors = scene.input.keyboard.createCursorKeys();
            this.keyZ = scene.input.keyboard.addKey('Z');
            this.keyX = scene.input.keyboard.addKey('X');
            this.keySpace = scene.input.keyboard.addKey('SPACE');
            this.keyP = scene.input.keyboard.addKey('P');

            // Prevent browser defaults for game keys
            scene.input.keyboard.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);
        }

        this.setupTouch();
    }

    /** Register a callback for game actions. */
    onAction(fn: (action: GameAction) => void): void {
        this.actionListeners.push(fn);
    }

    private emit(action: GameAction): void {
        for (const fn of this.actionListeners) fn(action);
    }

    /** Called every frame from the scene's update(). */
    update(): void {
        if (!this.scene.input.keyboard) return;

        // Rate-limited directional movement
        if (this.scene.input.keyboard.checkDown(this.cursors.left, INPUT_REPEAT_RATE)) {
            this.emit('move-left');
        }
        if (this.scene.input.keyboard.checkDown(this.cursors.right, INPUT_REPEAT_RATE)) {
            this.emit('move-right');
        }
        if (this.scene.input.keyboard.checkDown(this.cursors.up, INPUT_REPEAT_RATE)) {
            this.emit('move-up');
        }
        if (this.scene.input.keyboard.checkDown(this.cursors.down, INPUT_REPEAT_RATE)) {
            this.emit('move-down');
        }

        // One-shot keys (fire once on press)
        if (Phaser.Input.Keyboard.JustDown(this.keyZ)) {
            this.emit('rotate-ccw');
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyX)) {
            this.emit('rotate-cw');
        }
        if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
            this.emit('hard-drop');
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyP)) {
            this.emit('pause');
        }
    }

    // -----------------------------------------------------------------------
    // Touch / Swipe
    // -----------------------------------------------------------------------

    private setupTouch(): void {
        let startX = 0;
        let startY = 0;
        const SWIPE_THRESHOLD = 30;

        this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            startX = pointer.x;
            startY = pointer.y;
        });

        this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            const dx = pointer.x - startX;
            const dy = pointer.y - startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
                // Tap → rotate
                this.emit('rotate-cw');
                return;
            }

            if (absDx > absDy) {
                this.emit(dx > 0 ? 'move-right' : 'move-left');
            } else {
                if (dy > 0) {
                    // Swipe down → hard drop
                    this.emit('hard-drop');
                } else {
                    this.emit('move-up');
                }
            }
        });
    }

    destroy(): void {
        this.actionListeners = [];
    }
}
