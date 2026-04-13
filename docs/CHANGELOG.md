# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Shop upgrades (meta):
  - **Interest** — % of unspent gold paid out on shop open (caps at 50%, then stops appearing).
  - **Discount** — % off all shop-item prices (caps at 50%, then stops appearing).
  - **Free Reroll** — flat unlock, adds 1 free reroll per shop (max 3 purchases).
  - **Extra Slot** — flat unlock, +1 shop slot (max 2 purchases; shop grows from 6 → 8 cards).
  - **Extra Lock** — flat unlock, +1 lockable item (max 2 purchases, cap 3 locks). Tapping lock beyond cap evicts oldest lock.
- Shop upgrades (gameplay):
  - **Skip Throw** — adds redo charges (4/7/10/13/16 per rarity) that persist across levels. Redo button appears next to the launcher; tap to discard the current gem and pull the next from the queue.
  - **Rainbow Drop** — tiny, expensive chance that the launcher gem spawns as a rainbow (prestige-tinted). Caps at 2%.
- Shop framework: `ShopItemDef` now supports `flat` (no rarity scaling), `isAvailable` (filter maxed upgrades out of rolls), and `rarityPct` (custom per-rarity integer counts for things like Skip Throw).

### Changed
- Shop: Tier Skip base rate lowered from 3% to 2% (rarities scale off basePct, so uncommon is now 3%, rare 4%, epic 6%, legendary 10%).

### Fixed
- Overflow timer no longer runs during level-complete interludes (banner, countdown, shake, settle, shop, resume). Previously the player could game-over mid-shake despite being unable to fire. Accumulated timer carries across the interlude rather than resets, so a packed well still reads as danger when play resumes.
- Game over: "Time Survived" stat no longer keeps ticking up after death. `elapsedTime` now freezes when `state.gameOver` is true.
- Shop: "Continue Run" from the homepage now correctly re-opens the shop when the save was in the shop phase. The `openShop()` call was gated behind `interludeBlocks`, which the shop phase itself sets — so restoring directly into shop left the player staring at an empty field.
- Shop: tapping the lock icon no longer occasionally buys the item. The lock hit area was a 22px visual-sized rect; fat-finger taps just outside it fell through to `buyItem`. Hit rect is now padded ~14px while the visual button stays the same size.
- Auto-shake toggle on mobile: when auto-shake is OFF, random gravity oscillation was still applied — gems shook even with the phone held still. Now only real device motion drives shake gravity when auto-shake is disabled.
- iOS motion permission was requested from the game-loop countdown (not a user gesture) so it always silently failed. Now requested on the first tap/touch *and* when the user toggles auto-shake OFF — both guaranteed user-gesture contexts.
- Added on-screen motion readout during shake phase (mobile, auto-shake OFF): shows current magnitude, peak, and event count. Turns red with "MOTION SENSOR BLOCKED" if the listener isn't attached.
- Console warning when page is not a secure context (HTTPS / localhost) — required for `devicemotion` on recent iOS Safari and Chrome.
- Raised the gravity baseline subtraction from 7 to 9 (closer to true 9.8 gravity) so "still" actually reads as zero.

### Changed
- Replaced procedural pixel-art gem sprites with 12 photo-quality sphere PNGs (pebble + tier1-11)
- Expanded from 8 to 12 gem tiers: pebble, ore, geode, cluster, garnet, sapphire, emerald, topaz, amethyst, aquamarine, ruby, diamond
- Tiers 0-3 and 11 use baked-in natural colors; tiers 4-10 get runtime canvas colorization
- `src/game/gemSprites.ts` rewritten: loads sphere PNGs, applies tier color via canvas composite (source-atop + luminosity blend), supports rainbow animated hue cycling
- Enabled `imageSmoothingEnabled` for gem rendering (smooth downscaling of ~740px sphere assets)
- Physics normalization updated from hardcoded `/7` to dynamic tier count
- Persistence saves/restores rainbow flag (backward-compatible with old saves)

### Added
- **Rainbow prestige cycle**: two tier-11 diamonds merge into a rainbow-tinted pebble (tier 0); all subsequent tiers shimmer through animated rainbow hues; two rainbow tier-11s merge and disappear
- Rainbow gem rendering: 24-slot hue-cycling sprite cache + animated rainbow glow effect
- `scripts/process_gems.py` — reusable tool to remove white backgrounds from raw gem assets

### Added
- Peggle-style launcher aiming system (`src/game/launcher.ts`) — trajectory computation with parabolic arc and wall bounces, configurable launch speed, max-bounce cutoff
- Aim+fire input system (`src/game/input.ts`) — PC: mouse aim + left-click fire; Mobile: first finger aims, second finger tap fires
- Trajectory line renderer (`drawTrajectory` in renderer.ts) — animated dashed line with 3-segment fade-out, marching ants animation, endpoint crosshair
- Launcher gem preview (`drawLauncherGem` in renderer.ts) — pulsing glow ring at launch point showing next gem
- `consumeNextGem()` helper in state.ts for queue management without column placement
- Rounded bottom-corner physics: 10-segment arc bodies (R=45px) at each bottom corner so gems slide inward instead of stacking in corners; flat floor preserved
- Game persistence (`src/game/persistence.ts`) — full state save/restore via localStorage (gem positions+velocities+tiers, queue, score, combo, run stats); auto-saves on blur/visibilitychange/beforeunload; restores on page load with paused state
- Pause system — auto-pauses on tab switch/minimize/blur; dark overlay with gold "PAUSED" text + resume instruction; any tap/click resumes; capture-phase handler prevents accidental gem fire on resume
- Mobile performance profiler (`src/game/perfProfiler.ts`) — records per-frame metrics (FPS, frame time, gem count, canvas pixels, DPR), exposes `window.__perfReport()` for remote DevTools console, draws real-time overlay
- Performance baseline report (`docs/PERF_PROFILE.md`) — identifies DPR-uncapped canvas (8.3M px on DPR 3), per-gem procedural draw cost (3 calls/gem), and static UI redraw as top bottlenecks
- DPR-aware render config (`src/game/renderConfig.ts`) — scales glow radii, shadow offsets, and flash circles by `1/devicePixelRatio`; keeps physical-pixel coverage constant across screen densities; alpha compensated to maintain perceived brightness
- Adaptive DPR capping (`renderConfig.ts` + `canvas.ts`) — clamps effective DPR to configurable max (default 2) with pixel budget enforcement; on DPR-3 devices canvas drops from 8.3M to 3.7M pixels (56% reduction); CSS layout unaffected; `setMaxDpr()`/`setPixelBudget()` exposed via console for runtime tuning
- Render quality tiers (`renderConfig.ts`) — 3 presets (low/medium/high) controlling DPR cap, glow intensity, particle toggle, gem glow toggle, and pixel budget; auto-detected at startup via hardware concurrency, deviceMemory, screen size; user override via `__setQuality('low'|'medium'|'high')` in console; perf overlay shows active tier
- Offscreen board cache (`src/game/boardCache.ts`) — pre-renders static board background to offscreen canvas, blits with single `drawImage()` per frame replacing ~15 procedural draw calls; self-invalidates when dimensions change
- Adaptive effect frame-skipping (`renderConfig.ts`) — rolling FPS tracker gates expensive effects: glow, flash circles, particles skip every 2nd frame below 50 FPS, every 3rd frame below 35 FPS; timers keep advancing so animations expire correctly
- Smooth quality tier transitions (`renderConfig.ts`) — glow intensity interpolates at 4 units/s (~0.25s) when tier changes, preventing visual pop on tier switches
- 60-second automated stress test (`perfProfiler.ts`) — `__perfStressTest(60)` collects 60s of frame data and prints pass/fail verification against 60 FPS target; sample buffer expanded to 3700 frames (~60s)
- Performance verification report (`docs/PERF_VERIFICATION.md`) — frame budget analysis showing ~11–15ms total under 4x CPU throttle (within 16.67ms budget); documents all optimization layers and how to verify
- Lightweight particle system engine (`src/game/particles.ts`) — `ParticleSystem` class with spawn, update, render lifecycle; supports position, velocity, gravity, lifetime, color, alpha fade, size interpolation, and a 200-particle pool cap
- Particle system integrated into game loop (update + render each frame, cleared on restart)
- Merge-burst particle effect (`emitMergeBurst`) — 8–14 colored particles radiate from merge point with gravity falloff, ~400ms fade; count/speed/size scale with tier; white spark accents for visual pop
- Gem glow/shimmer effect — pulsing radial glow behind each gem using sine-wave alpha cycle; intensity and radius scale with tier (tier 0 subtle, tier 7 prominent); phase offset per tier for visual variety
- Landing impact dust-puff effect (`detectLandings`) — tracks per-body speed, emits 4–8 horizontal dust particles at gem base when velocity drops below threshold; particle count/spread/lifetime scale with impact speed; ~150–250ms duration

- Frontend overhaul: bucket fills bottom 3/4 of viewport, HUD panels moved to top 1/4 (BookBreaker-inspired dark arcade aesthetic)

### Changed
- HUD redesign: score → 40px top nav bar (BookBreaker-style); next gems → horizontal strip below bucket
- Container layout: portrait 440×770 at Y=115; landscape 420×580 at Y=100 — bucket fills ~80% of viewport
- Glass bucket visual: translucent blue-tinted interior, left/right specular wall highlights, narrow bright edge-catch lines, top rim reflection with specular spot, bottom caustic glows at rounded corners, floor vignette, double-border glass thickness illusion
- Score HUD: repositioned to top-left, gold accent score value, rounded panel with inner glow, monospace font
- Next gem panel: repositioned to top-right, rounded panel, compact 55px slot height, monospace font
- Color palette: deep navy viewport gradient (#080a12 → #0c1018), dark panels (#0f1520), cool-toned borders (#1a2030)
- All HUD/panel fonts switched from sans-serif to monospace for arcade aesthetic
- Particle spawn pool cull uses O(1) swap-remove instead of O(n) array shift
- Landing detector reuses a single Set across frames to avoid per-frame allocation
- Landing detector skips pruning pass when no stale entries possible
- Gem glow skips `createRadialGradient` when computed alpha < 0.02 or showParticles is off
- All three visual effects (merge burst, glow, landing dust) gated by `showParticles` setting for mobile perf toggle
- Initial project setup with HyperSpace
- AI agent system configuration in `.claude/agents/`
- Project documentation structure
- Full PRD with MVP feature specs and tech stack definition
- Architecture Decision Records (ADR-002: Tech Stack, ADR-003: Virtual Resolution)
- Project structure documentation
- MVP task breakdown in Hyperspace Nexus
- Gem data model (`Gem`, `GemDef` interfaces) with 8 tiers (quartz → opal)
- Drop-column grid layout (`GridConfig`, `DropZone`) with 7 columns centered in viewport
- `nearestDropZone()` helper for column snapping from pointer position
- `src/game/gems.ts` — gem types and grid configuration
- Board renderer (`src/game/renderer.ts`) — draws container, column dividers, drop zone strip
- Switched `main.ts` from Matter.Render wireframe to custom Canvas 2D rendering via `createCanvas` + `createRenderLoop`
- Replaced `<canvas id="game-canvas">` with `<div id="app">` container in `index.html`
- Unified pointer input handler (`src/game/input.ts`) — tracks pointerdown/move/up/cancel with virtual coordinate conversion
- Preview gem rendering (`drawPreviewGem`) — translucent gem + dashed drop guide follows pointer horizontally along drop zone
- `touch-action: none` on canvas to prevent scroll/zoom during play
- Column snapping — preview gem snaps to nearest column center via `nearestDropZone()`
- Active column highlight (subtle full-height overlay) shows target drop column
- Edge-case clamping: pointer outside board bounds snaps to nearest edge column
- Game state module (`src/game/state.ts`) — `GameState` with per-column gem stacking, `dropGem()`, `randomSpawnGem()`
- Drop-on-release mechanic — `input.onRelease` triggers `dropGem()` to place gem at lowest available position in snapped column
- Placed gem rendering (`drawPlacedGems`) — filled circles with border and inner highlight (top-left light source)
- Next gem preview cycles to a new random spawnable tier after each drop
- Gravity-based drop animation — gems fall from drop zone to resting position with acceleration (1800 px/s², capped at 1200 px/s)
- `PlacedGem` now tracks `currentY`, `velocityY`, and `falling` state for smooth animation
- `updateFallingGems()` ticks all falling gems each update frame; renderer draws at `currentY`
- Drop lock guard — blocks new drops while any gem is mid-fall (prevents rapid-tap duplicates)
- `pointercancel` handler resets state without firing drop (safe drag-off-board behavior)
- Column-full guard already returns null from `dropGem()` when stack exceeds container top
- Verified drop mechanic: Pointer Events API unified for mouse/touch, `isPrimary` multi-touch guard, `screenToVirtual` DPR-aware coordinate mapping, letterbox/resize handling, column stacking with variable radii
- Scoring state model (`src/game/scoring.ts`) — `ScoringState` interface with score, comboCount, comboMultiplier, highScore fields
- Scoring constants: `BASE_POINTS` (per-tier point values), `COMBO_THRESHOLDS` (combo→multiplier mapping: 3→2x, 5→3x, 7→4x, 10→5x), `BASE_MULTIPLIER`
- `createScoringState()` factory and `comboMultiplierFor()` helper
- Base points awarded on merge — `awardMergePoints()` calculates tier-based points and updates score
- Merge callback system (`setOnMerge` in `mergeExecutor.ts`) — fires after each successful merge with result tier
- Score changes logged to console on every merge (`[score] +N pts (tier X) → total Y`)
- Touch event listeners (touchstart, touchmove, touchend, touchcancel) on game board canvas for mobile drag-to-drop mechanics
- `TouchDragState` interface tracking drag status, tracked touch ID, start/current virtual coordinates
- Touch drag callbacks (`onTouchDragStart`, `onTouchDragMove`, `onTouchDragEnd`, `onTouchDragCancel`) on `InputHandler`
- Console logging (`[Touch]`) on all touch events for debugging on mobile/touch devices
- `preventDefault` on all touch events with `{ passive: false }` to suppress scroll/zoom during drag
- Single-finger tracking: only first touch is tracked, additional fingers ignored
- Combo detection and tracking — `registerMerge()` increments combo counter for merges within 1.5s window (`COMBO_WINDOW`), resets on timeout
- `updateCombo()` called each game tick to expire stale combos and reset multiplier
- `lastMergeTime` field on `ScoringState` for time-window tracking
- Console log now includes combo count and multiplier per merge event
- Touch-to-grid coordinate mapping (`virtualToGrid()` in `gems.ts`) — converts virtual X/Y to column index and row index
- `GridCell` interface with `column`, `row`, and `inBounds` fields
- `gridCell` field on `TouchDragState` — updated on every touch event for downstream grid queries
- All touch event console logs now include grid cell position (col, row, inBounds)
- Combo multiplier applied to merge points — `awardMergePoints` uses `scoring.comboMultiplier` (2x at combo 3, 3x at 5, 4x at 7, 5x at 10)
- Scoring state reset on game restart (score, combo, elapsed time cleared; high score preserved)
- Touch drag pickup system (`src/game/touchDrag.ts`) — hit-tests gem bodies under touch point, tracks drag state with origin position and touch offset
- Dragged gem follows finger in real-time via `moveDraggedGem()` with offset to prevent snap-to-center
- Visual lift feedback: dragged gem scales to 1.15× with 0.8 opacity and drop shadow, rendered on top of all other gems
- `pickupGem()` makes body static during drag to prevent physics interference; `cancelDrag()` snaps back to origin
- Touch drag callbacks wired in main.ts (`onTouchDragStart`, `onTouchDragMove`, `onTouchDragCancel`)
- Score & combo HUD panel (`drawScoreHUD` in `renderer.ts`) — rendered left of board, shows current score, combo count (Nx COMBO), and multiplier (Nx MULT)
- Combo indicator appears when comboCount >= 2; color-coded by multiplier tier (green 2x, yellow 3x, red 4x+)
- HUD panel dynamically resizes to accommodate combo section
- Drop target preview while dragging (`drawDropTargetPreview` in `renderer.ts`) — highlights target column during touch drag
- Valid drop: green column highlight with left/right border glow and dashed landing circle at column bottom
- Invalid drop (out-of-bounds): red column overlay with X rejection indicator at column center
- Drop target rendered behind gems in draw order for proper visual layering
- High score persistence via localStorage — `loadHighScore()` reads on game load, `saveHighScore()` writes on game over if current score beats record
- localStorage key `gemjam_high_score`; graceful fallback to 0 on missing/invalid/quota-error
- High score loaded into `ScoringState` at init via `createScoringState(loadHighScore())`; preserved across restarts
- Release-to-drop placement logic (`handleTouchDrop()` in `touchDrag.ts`) — valid drops snap gem X to nearest column center and re-enable physics; invalid drops trigger snap-back animation
- Snap-back animation (`updateSnapBack()`) — ease-out-quad interpolation over 0.25s returns gem to origin on invalid/out-of-bounds drop
- `onTouchDragEnd` callback wired in main.ts to call `handleTouchDrop()` on finger release
- `updateSnapBack(dt)` ticked in game loop to drive return-to-origin animation
- touchcancel now checks tracked touch identifier before cancelling (prevents false cancel from unrelated finger)
- `cancelDrag()` uses animated snap-back instead of instant teleport for consistent UX
- `visibilitychange` listener cancels active drag when page is hidden (app switch, screen lock)
- `blur` listener cancels active drag when window loses focus
- All new listeners cleaned up in `destroy()`
- Merge detector skips static gem bodies (`isStatic` guard in `mergeDetector.ts`) — prevents false merges during drag or snap-back animation
- Touch-dropped gems integrate with existing merge pipeline: valid drop → `setStatic(false)` → gravity → collision → merge detection → merge execution → score update + animation
- High score visible during gameplay in score HUD panel (BEST label + gold value)
- `bestCombo` field on `ScoringState` — tracks highest combo achieved per run, updated in `registerMerge()`
- Game-over summary (`drawGameOverSummary` in `renderer.ts`) — shows final score, best combo, and "NEW HIGH SCORE!" indicator (gold text) when record is beaten
- `isNewHighScore` flag captured from `saveHighScore()` return value on game over; reset on restart
- End-to-end scoring verification: TS compile clean, Vite production build passes, all scoring flows traced (base points, combo multiplier, localStorage persistence, high-score-only-when-beaten guard)

### Fixed
- Pointer events now skip `pointerType === 'touch'` in `handleDown`, `handleMove`, `handleUp` — prevents phantom gem drops from pointer/touch dual-firing on mobile
- `touchmove` console.log throttled to fire only when grid cell changes (was 60 Hz, caused GC jank)
- `restartGame()` cancels active touch drag and removes ALL gem bodies (including static/dragged) — prevents stuck invisible gems after restart
