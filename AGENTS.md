# Development Plan — GraviBlocks

> Living document for AI agents and developers. Tracks architectural intent, stage progression, and open decisions.

## Game Concept

A web-based grid-logic 2D puzzle game. Tetromino-like pieces spawn from **4 sides** (top, bottom, left, right) and fall **toward a static center piece**. The player fills a target shape by landing blocks against the center. Modes will vary from "fill a square" (standard) to "fill an exact shape with no spillage" (puzzle).

---

## Architecture — Model-View Split

**Why decouple?** The game has two very different update rates. Grid logic is discrete (step-based, on a timer); visuals are continuous (60 fps tweens, particles). Keeping the model as pure TypeScript also makes it unit-testable without Phaser.

```
Input → GameScene → GameSimulation (model) → emits events → Views react
```

- **Model layer** (`src/game/model/`): Pure TypeScript. Zero Phaser imports. Owns game rules, board state, piece shapes, scoring. Emits events on state changes.
- **View layer** (`src/game/view/`): Reads model state, creates/updates Phaser GameObjects. Subscribes to model events for animations.
- **Scenes** (`src/game/scenes/`): Phaser scenes wire model + view together. GameScene owns the simulation; UIScene runs in parallel for HUD.
- **Input** (`src/game/input/`): Abstracts keyboard + touch into game actions so the simulation never knows about raw keys.

---

## Stage 0 — Scaffold ✅

- Vite + TypeScript + Phaser 3.90
- Path aliases (`@model/`, `@view/`, etc.)
- Folder structure matching the architecture above
- No React, no telemetry, no unnecessary deps

## Stage 1 — Grid Model (Pure Logic)

Build the entire game simulation with zero rendering. Everything should be testable by logging board state to console.

| File | Responsibility |
| ------ | --------------- |
| `BoardModel` | 2D `Cell[][]` array. Knows about center cells, target cells, occupied cells. Win/loss checks. |
| `PieceModel` | Tetromino shape as relative offsets. Rotation via matrix transform. |
| `PieceSpawner` | Picks next spawn side (random / CW / CCW). Computes spawn position at board edge and fall direction vector. |
| `GameSimulation` | Owns the above. Runs the game loop: spawn → fall → land → check win. Emits events. |
| `LevelConfig` | Data type for level definitions. A few starter levels hardcoded. |

**Key design choice — custom grid over Phaser Tilemap:** Tilemap is optimized for Tiled-editor map loading. Our game has unique 4-directional gravity and a center piece, which don't map to Tilemap assumptions. A plain `Cell[][]` is simpler and fully controlled.

## Stage 2 — Basic Rendering

Programmer-art (colored rectangles). BoardView and PieceView read model state and render Phaser Rectangles. Camera auto-scales to fit the board. Grid-line debug overlay toggleable.

## Stage 3 — Input & Controls

InputManager abstracts keyboard/touch into `MOVE_LEFT`, `MOVE_RIGHT`, `ROTATE_CW`, `ROTATE_CCW`, `HARD_DROP`. Uses `checkDown()` for rate-limited repeats. MVP uses absolute arrow keys (not remapped per fall direction).

**Why absolute keys first?** Remapping left/right based on fall direction is disorienting without visual cues. Start simple, add as an option in settings later.

## Stage 4 — Juice & Feel

Squash/stretch tweens on landing, screen shake, particle bursts, smooth grid-movement tweens. All centralized in `JuiceManager` that subscribes to model events.

**Why a JuiceManager?** Keeps GameScene clean. Adding a new effect = subscribe to an event, fire a tween. No game logic touched.

## Stage 5 — Game Loop & Polish

Speed progression, piece preview queue, game over / win states, main menu scene, pause, scoring, sound placeholders.

## Stage 6 — Future (Post-MVP)

Puzzle mode (exact fill), custom shapes, endless mode, mobile packaging, optional Matter.js wobble.

---

## Open Decisions

- [x] Game name: **GraviBlocks**
- [ ] Relative vs absolute controls — start absolute, revisit after playtesting
- [ ] Grid zoom behavior when board is large — try simple camera zoom first
- [ ] Sound library — Phaser built-in audio vs Howler.js
- [ ] Level progression curve — needs playtesting data

## Conventions

- Model classes: **no Phaser imports**. If you need `import 'phaser'` in a model file, something is wrong.
- Events: use the shared `EventBus` (not Phaser scene events) for cross-concern communication.
- Constants: `src/game/config/Constants.ts` — cell sizes, colors, timing values. Never hardcode magic numbers in logic.
- Naming: `PascalCase` for classes/types, `camelCase` for variables/functions, `UPPER_SNAKE` for constants.
