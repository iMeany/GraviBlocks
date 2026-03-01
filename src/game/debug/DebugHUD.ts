// ---------------------------------------------------------------------------
// DebugHUD — on-screen overlay that shows live game state.
// Toggle with backtick (`) key. Renders as a Phaser Text object on top.
// ---------------------------------------------------------------------------

import Phaser from 'phaser';
import { eventBus } from '../events/EventBus';
import { GameEvents } from '../events/GameEvents';
import type { GameSimulation } from '../model/GameSimulation';

export class DebugHUD {
    private sim: GameSimulation;
    private text: Phaser.GameObjects.Text;
    private visible = false;
    private toggleKey: Phaser.Input.Keyboard.Key | null = null;
    private eventLog: string[] = [];
    private maxLogLines = 8;

    constructor(scene: Phaser.Scene, sim: GameSimulation) {
        this.sim = sim;

        this.text = scene.add.text(8, 8, '', {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#00ff88',
            backgroundColor: '#000000aa',
            padding: { x: 6, y: 4 },
            wordWrap: { width: 460 },
        });
        this.text.setDepth(999);
        this.text.setScrollFactor(0);
        this.text.setVisible(false);

        if (scene.input.keyboard) {
            this.toggleKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK);
            this.toggleKey.on('down', () => this.toggle());
        }

        this.bindEvents();
    }

    private bindEvents(): void {
        eventBus.on(GameEvents.PIECE_SPAWNED, this.logEvent('SPAWN'));
        eventBus.on(GameEvents.PIECE_LANDED, this.logEvent('LAND'));
        eventBus.on(GameEvents.GAME_WON, this.logEvent('WIN'));
        eventBus.on(GameEvents.GAME_OVER, this.logEvent('OVER'));
    }

    private logEvent(label: string) {
        const fn = (...args: unknown[]) => {
            const detail =
                typeof args[0] === 'object' && args[0] !== null
                    ? JSON.stringify(args[0], null, 0).slice(0, 80)
                    : String(args[0] ?? '');
            this.eventLog.push(`${label}: ${detail}`);
            if (this.eventLog.length > this.maxLogLines) {
                this.eventLog.shift();
            }
        };
        // Store ref for cleanup
        (fn as { _label?: string })._label = label;
        return fn;
    }

    toggle(): void {
        this.visible = !this.visible;
        this.text.setVisible(this.visible);
    }

    update(): void {
        if (!this.visible) return;

        const s = this.sim;
        const p = s.currentPiece;
        const tf = this.countTarget();

        const lines = [
            `--- GRAVIBLOCKS DEBUG ---`,
            `phase: ${s.phase}`,
            `score: ${s.score}  landed: ${s.piecesLanded}`,
            `target: ${tf.filled}/${tf.total}  spillage: ${s.board.hasSpillage()}`,
            `side: ${s.pieceSide}  fallDir: (${s.fallDir.dx},${s.fallDir.dy})`,
            p ? `piece: ${p.shapeName} @ (${s.pieceCol},${s.pieceRow})  ${p.color}` : `piece: none`,
            ``,
            `--- RECENT EVENTS ---`,
            ...this.eventLog,
        ];

        this.text.setText(lines.join('\n'));
    }

    private countTarget(): { filled: number; total: number } {
        let filled = 0;
        let total = 0;
        const b = this.sim.board;
        for (let row = 0; row < b.height; row++) {
            for (let col = 0; col < b.width; col++) {
                const cell = b.getCell(col, row);
                if (cell?.isTarget) {
                    total++;
                    if (cell.occupied) filled++;
                }
            }
        }
        return { filled, total };
    }

    destroy(): void {
        this.text.destroy();
        if (this.toggleKey) {
            this.toggleKey.removeAllListeners();
        }
    }
}
