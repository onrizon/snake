# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build
npm run start    # serve production build
```

No test suite or linter is configured.

## Architecture

Single-page Next.js 14 app (App Router). The entire game lives in one component:

```
app/
  components/SnakeGame.js   # all game logic + rendering (~420 lines)
  lib/dictionary.js         # dictionary loading, word validation, scoring, letter pool
  globals.css               # dark theme, body centering
  layout.js / page.js       # thin wrappers
public/
  enable1.txt               # ENABLE1 Scrabble word list (172 k words, ~1.7 MB)
```

### State split

`SnakeGame.js` separates state into two buckets:

- **`stateRef`** (mutable ref, never triggers re-renders) — everything the game loop touches every 130 ms: `snake[]`, `letters[]`, `direction`, `nextDirection`, `buffer`, `foundInRun` Set, `score`, `floatingLabels[]`.
- **React state** (`useState`) — display-only values that need re-renders: `score`, `highScore`, `mistakes`, `buffer`, `foundWords`, `flash`, `gameOver`, `paused`, `speed`, `canvasSize`.

### Game loop

`setInterval(tick, speed)` is the heartbeat. The `speed` state starts at 130 ms and drops by 3 ms per 100 points (floor 60 ms). Changing `speed` restarts the interval because it's in the `useEffect` dependency array.

`tick()` → move head → collision check → if letter eaten: append to buffer → check `isWord` / `isPrefix` → score or penalise → `draw()`.

### Dictionary

`loadDictionary()` fetches `enable1.txt` once (module-level cache), uppercases and sorts the word list, and returns `{ words: string[], set: Set<string> }`.

- `isWord` → O(1) Set lookup.
- `isPrefix` → O(log N) binary search on the sorted array (checks if any word starts with the prefix).

Tile letters are drawn from `WEIGHTED_POOL`, a pre-built array weighted by English letter frequency.

### Scoring

`wordScore(w) = round(letterSum × (1 + 0.1 × length))` where letter values mirror Scrabble (A/E/…/R = 1, Q/Z = 10, etc.).

Dead-end penalty (buffer can't be a prefix of any word): `−3 × buffer.length`, mistake counter +1.

High score is persisted to `localStorage` under the key `snake_best`.

### Canvas rendering

`draw()` redraws the full 18×18 grid on every tick using the 2D Canvas API. Cell size (`cellRef`) is computed from viewport width and recalculated on `resize` — keeps the canvas responsive on mobile.

Letter tiles are highlighted cyan if `buf + tile` is a valid prefix, green if it's a complete word — giving the player visual look-ahead.

Floating score labels (`+N WORD`) are stored in `stateRef.floatingLabels`, rendered with decreasing `globalAlpha` over 900 ms, and pruned inside `draw()`.
