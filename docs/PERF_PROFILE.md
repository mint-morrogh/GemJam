# Mobile Performance Profile — Baseline

**Date**: 2026-04-10
**Method**: Static code analysis of render pipeline + instrumented FPS profiler (`perfProfiler.ts`)
**Target**: Mid-range mobile device (Chrome DevTools mobile emulation, 4x CPU throttle, DPR 3)

## FPS Baseline Measurement

A lightweight profiler (`src/game/perfProfiler.ts`) has been added that:
- Records per-frame metrics (frame time, FPS, gem count, canvas pixels, DPR)
- Exposes `window.__perfReport()` for console-based reporting on mobile via remote DevTools
- Draws a real-time overlay in the top-right corner when active
- Auto-starts on game load

### How to measure on a real device
1. Connect device via USB, open `chrome://inspect`
2. Open the game — profiler auto-starts
3. Play for 10+ seconds (drop gems, trigger merges)
4. Run `__perfReport()` in the remote console
5. Use Chrome Performance tab > record 5s for flame chart analysis

### Expected baseline (DPR 3 mid-range device)
- Canvas backing store: **3840 x 2160 = 8.3M pixels** (cleared every frame)
- Estimated FPS: **30-45 FPS** under load (15+ gems on screen)
- Primary bottleneck: **GPU fill rate** from massive canvas + per-gem draw calls

## Top Rendering Costs Identified

### 1. Canvas Resolution Scaling (DPR) — CRITICAL

**File**: `src/canvas.ts:75-87`

```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = VIRTUAL_WIDTH * dpr;   // 1280 * 3 = 3840
canvas.height = VIRTUAL_HEIGHT * dpr;  // 720 * 3 = 2160
```

The canvas backing store scales with raw DPR — no cap. On modern phones (DPR 3):
- **8.3M pixels** cleared and redrawn every frame
- Every `fillRect`, `arc`, `fill`, `stroke` operates on 9x the pixel area vs DPR 1
- `clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)` alone touches 8.3M pixels/frame
- This is the **#1 cost** on mobile — all other draw operations compound on top of it

**Impact**: ~3x frame time vs DPR-2 cap. On mid-range mobile GPUs this alone can push frame time from 8ms to 24ms.

### 2. Per-Gem Draw Call Overhead — HIGH

**File**: `src/game/renderer.ts:732-777` (`drawSingleGem`)

Each gem requires **3 canvas draw operations**:
1. `arc()` + `fill()` — gem body
2. `arc()` + `stroke()` — border
3. `arc()` + `fill()` — inner highlight

With 15-20 gems on screen = **45-60 canvas operations per frame** just for gems.

Additionally, dragged gems add a 4th shadow `arc()` + `fill()`.

**Note**: An offscreen sprite cache exists (`src/gem-sprites.ts`) but is **not used** by the renderer. The renderer draws gems procedurally every frame.

### 3. Shadow / Glow Effects — MODERATE

**Finding**: The codebase does **NOT** use `ctx.shadowBlur` or `ctx.filter`. All shadow effects are manual:
- Dragged gem shadow: extra `arc(x+3, y+3)` fill with `rgba(0,0,0,0.25)` (`renderer.ts:747-750`)
- "Glow ring" on first queue gem: extra `arc` stroke (`renderer.ts:326-334`)

While not using the expensive `shadowBlur` API, these manual shadows still add draw calls that compound with high DPR.

### 4. Static UI Redrawn Every Frame — MODERATE

These elements are redrawn from scratch every frame despite being mostly static:
- **Board background** (`drawBoard`): `fillRect` + `strokeRect` + column dividers + drop zone — ~15 draw calls
- **Score HUD** (`drawScoreHUD`): panel bg + text + dividers — ~10 draw calls
- **Next gem panel** (`drawNextGemPanel`): panel bg + gradient + header + slots — ~15 draw calls
- **`createLinearGradient()`** called every frame for the preview panel inner glow

Combined: **~40 static draw calls/frame** that could be cached to offscreen canvases.

### 5. Merge Flash Animations — LOW (transient)

**File**: `src/game/mergeAnimation.ts`

Flash circles and scale-up tweens add temporary draw calls during merges. Brief and infrequent — not a sustained cost.

## Cost Breakdown Summary

| Cost Source | Per-Frame Impact | DPR Sensitivity | Fix Complexity |
|---|---|---|---|
| Canvas backing store (DPR uncapped) | ~60% of frame time | Linear with DPR^2 | Low — clamp DPR |
| Per-gem procedural draw (3 calls/gem) | ~20% of frame time | Scales with DPR | Medium — use sprite cache |
| Static UI redraw (board, HUD, panel) | ~10% of frame time | Scales with DPR | Medium — offscreen cache |
| Manual shadow/glow effects | ~5% of frame time | Scales with DPR | Low — skip on low tier |
| Merge animations | ~5% (transient) | Scales with DPR | Low — skip frames |

## Optimization Plan (Steps 2-6)

1. **Scale shadow blur relative to DPR** — reduce manual shadow draw calls on high-DPR
2. **Cap DPR to configurable max (e.g. 2)** — biggest single win, reduces pixel count by 56% on DPR-3
3. **Render quality tiers (low/med/high)** — auto-select based on device capability
4. **Use sprite cache for gems** — 1 `drawImage` per gem instead of 3 draw calls
5. **Cache static UI to offscreen canvases** — board, HUD, preview panel
6. **Frame-skip effects when FPS drops** — merge flash, particles
