# GraviBlocks

A web-based grid-logic 2D puzzle game built with Phaser 3, TypeScript, and Vite.

Pieces spawn from four sides and fall toward a static center piece. Two modes:

- **Normal** — fill the target zone without spilling outside it.
- **Classic** — Tetris-style endless play: fill rows or columns in the target zone to clear them; blocks compact toward the center. Score attacks and speed progression.

## Quick Start

```bash
npm install
npm run dev      # starts Vite dev server at localhost:8080
npm run build    # type-check + production build → dist/
npm run preview  # preview production build locally
```

## Core Decisions & Rationale

### Why Phaser 3 (not raw Canvas/PixiJS)?

Phaser gives us a battle-tested tween engine, camera effects (shake/zoom/flash), particle system, and input handling out of the box — exactly the "juice" layer this game needs. We don't use its physics or tilemap systems.

### Why a custom grid model (not Phaser Tilemap)?

The game has 4-directional gravity toward a center piece. Tilemap assumes a Tiled-editor workflow and single-direction scrolling. A plain `Cell[][]` array is simpler and gives us full control over collision, placement, and win-condition logic.

### Why Model-View split?

Grid logic updates discretely (step-based, ~500ms ticks). Visuals update at 60fps (tweens, particles). Decoupling them means the model can run and be tested without rendering, and the view can interpolate freely between states. Model files have zero Phaser imports.

### Why no Matter.js in MVP?

Tween-based squash/stretch gives full artistic control without the complexity of syncing physics bodies to grid coordinates. We can revisit for cosmetic wobble later.

### Why absolute arrow keys (not relative to fall direction)?

When a piece falls from the left side, should "left arrow" mean "toward the top of the screen" or "away from center"? Relative mapping is disorienting without strong visual cues. We start with absolute screen-space controls and add relative as an option later.

### Why parallel UI scene?

Phaser supports running multiple scenes simultaneously. `UIScene` renders the HUD (score, next piece, level) on its own camera layer above `GameScene`. This keeps game logic, rendering logic, and UI logic in separate files with no entanglement.

### Why EventBus over direct coupling?

The model emits events (`piece-landed`, `game-won`). Views subscribe and react. Adding a new visual effect means subscribing to an event — zero changes to game logic. This is the primary extensibility mechanism.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys (perpendicular to fall) | Move piece left / right / up / down |
| Arrow key (fall direction) | Soft drop — accelerate one step toward center |
| Z | Rotate counter-clockwise |
| X | Rotate clockwise |
| Space | Hard drop (piece teleports to landing position; brief lock-delay before locking) |
| P | Pause / unpause |
| R | Restart current level |
| ESC | Return to main menu |
| ` (backtick) | Toggle debug HUD |

Swipe and tap are supported for touch input.

## Debug Tools

- **Browser console**: All game events are logged with `[GRAVI]` prefix — filter with that tag. Type `__gravi.dumpState()` in the console for a full state snapshot.
- **On-screen HUD**: Press backtick (`` ` ``) to toggle a live overlay showing phase, score, target progress, spawn side, and a rolling event log.

## Project Structure

```text
src/
  main.ts                     # Vite entry → creates Phaser.Game
  game/
    model/                    # Pure TS — game rules, zero Phaser imports
      BoardModel.ts           # 2D cell grid, win/loss checks
      PieceModel.ts           # Tetromino shapes, rotation
      PieceSpawner.ts         # Spawn side selection, edge positioning
      GameSimulation.ts       # Orchestrates model, emits events
    view/                     # Phaser GameObjects — reads model state
      BoardView.ts            # Renders grid cells as colored rectangles
      PieceView.ts            # Renders falling piece, ghost piece
      JuiceManager.ts         # Squash/stretch, shake, particles
    scenes/
      BootScene.ts            # Minimal — starts preloader
      PreloadScene.ts         # Asset loading
      MainMenuScene.ts        # Title screen
      GameScene.ts            # Owns simulation + views + debug
      UIScene.ts              # HUD overlay (score, level name)
    input/
      InputManager.ts         # Keyboard + touch → game actions
    config/
      Constants.ts            # Sizes, colors, timing
      LevelConfig.ts          # Level data definitions
    events/
      EventBus.ts             # Shared event emitter
      GameEvents.ts           # Event name constants
    debug/
      DebugLogger.ts          # Console logging with [GRAVI] prefix
      DebugHUD.ts             # On-screen live state overlay
```

## Conventions

- **Model files must never import Phaser.** If a model file needs a Phaser type, the architecture is wrong.
- **No magic numbers.** All tuning values go in `Constants.ts` or `LevelConfig`.
- **Events over direct calls** for cross-layer communication.
- **PascalCase** classes/types, **camelCase** variables/functions, **UPPER_SNAKE** constants.
