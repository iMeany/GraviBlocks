# Development Plan — GraviBlocks

> Living document for AI agents and developers. Tracks architectural intent, stage progression, and open decisions.

## Game Concept

A web-based grid-logic 2D puzzle game. Tetromino-like pieces spawn from **4 sides** (top, bottom, left, right) and fall **toward a static center piece**. The player fills a target shape by landing blocks against the center. Three modes are planned:

- **Normal** — fill the target zone without any blocks spilling outside it.
- **Classic** — Tetris-inspired endless mode. Completed rows/columns inside the target zone are cleared; remaining blocks compact toward the center. Score multipliers and speed progression.
- **Puzzle** (future) — fill an exact shape with zero spillage allowed.

---

## Architecture — Model-View Split

**Why decouple?** The game has two very different update rates. Grid logic is discrete (step-based, on a timer); visuals are continuous (60 fps tweens, particles). Keeping the model as pure TypeScript also makes it unit-testable without Phaser.

```text
Input → GameScene → GameSimulation (model) → emits events → Views react
```

- **Model layer** (`src/game/model/`): Pure TypeScript. Zero Phaser imports. Owns game rules, board state, piece shapes, scoring. Emits events on state changes.
- **View layer** (`src/game/view/`): Reads model state, creates/updates Phaser GameObjects. Subscribes to model events for animations.
- **Scenes** (`src/game/scenes/`): Phaser scenes wire model + view together. GameScene owns the simulation; UIScene runs in parallel for HUD.
- **Input** (`src/game/input/`): Abstracts keyboard + touch into game actions so the simulation never knows about raw keys.
- **Debug** (`src/game/debug/`): DebugLogger dumps all events to browser console with `[GRAVI]` prefix. DebugHUD shows live state overlay (toggle with backtick key). Both are wired in GameScene and destroyed on cleanup.

---

## Stage 0 — Scaffold ✅

- Vite + TypeScript + Phaser 3.90
- Path aliases (`@model/`, `@view/`, etc.)
- Folder structure matching the architecture above
- No React, no telemetry, no unnecessary deps

## Stage 1 — Grid Model (Pure Logic) ✅

Build the entire game simulation with zero rendering. Everything should be testable by logging board state to console.

| File | Responsibility |
| ------ | --------------- |
| `BoardModel` | 2D `Cell[][]` array. Knows about center cells, target cells, occupied cells. Win/loss checks. |
| `PieceModel` | Tetromino shape as relative offsets. Rotation via matrix transform. |
| `PieceSpawner` | Picks next spawn side (random / CW / CCW). Computes spawn position at board edge and fall direction vector. |
| `GameSimulation` | Owns the above. Runs the game loop: spawn → fall → land → check win. Emits events. |
| `LevelConfig` | Data type for level definitions. A few starter levels hardcoded. |

**Key design choice — custom grid over Phaser Tilemap:** Tilemap is optimized for Tiled-editor map loading. Our game has unique 4-directional gravity and a center piece, which don't map to Tilemap assumptions. A plain `Cell[][]` is simpler and fully controlled.

## Stage 2 — Basic Rendering ✅

Programmer-art (colored rectangles). BoardView and PieceView read model state and render Phaser Rectangles. Camera auto-scales to fit the board. Grid-line debug overlay toggleable.

## Stage 3 — Input & Controls ✅

InputManager abstracts keyboard/touch into `MOVE_LEFT`, `MOVE_RIGHT`, `ROTATE_CW`, `ROTATE_CCW`, `HARD_DROP`. Uses `checkDown()` for rate-limited repeats. MVP uses absolute arrow keys (not remapped per fall direction).

**Why absolute keys first?** Remapping left/right based on fall direction is disorienting without visual cues. Start simple, add as an option in settings later.

## Stage 4 — Juice & Feel ✅

Squash/stretch tweens on landing, screen shake, particle bursts, smooth grid-movement tweens. JuiceManager exposes methods called by GameScene at the right time in the pipeline (not auto-subscribing to events).

**Why explicit calls instead of auto-subscribing?** The order matters: board must sync colors before tweens target the cells. GameScene orchestrates: sync → juice → reset timer.

## Stage 5 — Game Loop & Polish (In Progress)

Speed progression, piece preview queue, game over / win states, main menu scene, pause, scoring, sound placeholders.

**Implemented:**

- Win/game-over overlays with camera reset, double-cleanup guard, any-key-to-continue.
- Level transitions working (3 Normal levels).
- Debug tools (DebugLogger + DebugHUD). Restart with R key, ESC → main menu.
- **Classic mode**: line-clear logic scoped to target zone, `shiftInward` compacts cleared rows vertically and cleared columns horizontally (not both unless both were cleared simultaneously). Scoring (100/25/10 landing pts; 200×n + 50×(n-1) clear bonus). Next-piece preview queue. Mode-badge + LINES counter in UIScene. Speed progression.
- **Soft drop**: fall-direction arrow key advances one step and resets the fall timer.
- **Hard-drop lock delay** (`lock-delay` phase, 150 ms): piece teleports on Space but locks only after the delay, allowing last-moment nudges/rotations.
- **Line-clear animation**: cleared cells flash white; surviving cells slide from their old positions to their new (compacted) positions via overlay tweens in JuiceManager.
- **4-side spawn indicators**: colored edge bars highlight the active spawn side on each new piece.
- **Classic shape pool**: Dot/Duo/Tri pieces excluded in Classic mode (standard 7-bag shapes only).

## Stage 6 — Classic Mode Depth (Planned)

Features that make Classic mode feel complete and strategic.

### 6a — Per-side "Up Next" preview

Currently there is one global next-piece queue. Classic spawns from all 4 sides, so the player has no way to plan.

**Design:**

- `GameSimulation` maintains 4 independent `nextPiece` slots, one per side (`top | right | bottom | left`).
- On spawn, the piece for the active side is consumed and immediately replaced.
- `NEXT_PIECE_CHANGED` event carries `{ side, piece }` so the UI can update the correct panel.

**Visualisation options (pick one before implementing):**

- Four small preview boxes in the four screen corners, each labelled with a directional arrow.
- Four mini-panels inset along each board edge, centred on that edge (more spatial — player sees "the next piece coming from the left" on the left side of the board).
- A 2×2 grid of previews somewhere in the HUD, rows = top/bottom, cols = left/right.

Corner panels are the simplest starting point; edge-inset panels are more intuitive but require BoardView coordinate helpers.

### 6b — Hold mechanic

Standard Tetris hold: press a key (e.g. **C** or **Shift**) to swap the current falling piece with a held piece. Can only be used once per piece (resets on land).

**Model changes (`GameSimulation`):**

- `heldPiece: PieceModel | null` field.
- `holdUsed: boolean` flag, reset to `false` in `spawnPiece()`.
- `holdPiece()` method: if `holdUsed` → do nothing. Swap `currentPiece` ↔ `heldPiece`; if `heldPiece` was null, immediately spawn the next queued piece for this side. Reset piece position to spawn edge. Set `holdUsed = true`. Emit `HOLD_CHANGED` event.

**UI:** A "HOLD" panel (similar to NEXT panel) in UIScene. Greyed-out when `holdUsed` is true.

**Input:** Add `'hold'` to `GameAction`; wire to C / Shift in `InputManager`. Handle in `GameScene.handleAction`.

### 6c — Classic mode starts with a 1×1 center block

The plus-shaped center in `CLASSIC_CONFIG` is actually 5 cells — too large for a 30×30 board and makes line-clears too easy near the center. Classic should start with a single 1×1 center cell so the target zone is fully clearable.

**Change:** Update `CLASSIC_CONFIG` in `LevelConfig.ts`:

```ts
centerCells: [{ col: 15, row: 15 }],
targetCells: rect(13, 13, 5, 5),  // unchanged
```

The single center cell still blocks passage; cleared rows/cols compact up to but not over it (the `!cell.isCenter` guards in `clearRow`/`shiftInward` already handle this correctly).

### 6d — Growing center block every 10 lines

After every 10 lines cleared in Classic, the center obstacle grows by one ring, turning 1×1 → 3×3 → 5×5 etc. This progressively shrinks the clearable target zone and forces the player to adapt.

**Model changes (`GameSimulation`):**

- Track `totalLinesCleared`. On each `LINES_CLEARED` event check `Math.floor(totalLinesCleared / 10) > Math.floor((totalLinesCleared - n) / 10)` to detect a threshold crossing.
- On crossing: compute new center size `= 1 + 2 * tier` (tier 0 → 1×1, tier 1 → 3×3, tier 2 → 5×5 …). Call `board.growCenter(newSize)`.

**`BoardModel.growCenter(size)`** — new method:

- Computes the new center rectangle centred on board midpoint.
- Marks new cells as `isCenter = true`, `occupied = true`.
- Any player-placed blocks in the newly-occupied cells are evicted (set `occupied = true`, `color = null` — they simply vanish; consider emitting a `CENTER_GREW` event so JuiceManager can flash those cells).

**UI:** Emit `CENTER_GREW` event; GameScene can do a brief camera zoom-pulse via `JuiceManager.playWinEffect()`.

### 6e — High score system

Persist the top scores across sessions using `localStorage`.

**Design:**

- `HighScoreService` (new file `src/game/services/HighScoreService.ts`) — pure TS, no Phaser.
  - `load(): ScoreEntry[]` — reads JSON from `localStorage`.
  - `save(entries: ScoreEntry[]): void`
  - `submit(name: string, score: number, lines: number, date: string): ScoreEntry[]` — inserts, sorts descending by score, trims to top 10, saves, returns updated list.
- `ScoreEntry`: `{ name: string; score: number; lines: number; date: string }`.
- On Classic game-over, transition to a name-entry screen (or inline text input using Phaser's DOM input) before showing the leaderboard.
- **MainMenuScene** gets a "HIGH SCORES" button that launches a `HighScoreScene` (new scene, reads from `HighScoreService`).

---

## Stage 7 — Future (Post-Classic)

Puzzle mode (exact fill), custom shapes, mobile packaging, optional Matter.js wobble, online leaderboard via a lightweight backend.

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
