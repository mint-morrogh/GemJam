// ---------------------------------------------------------------------------
// Lightweight mobile performance profiler
// ---------------------------------------------------------------------------
// Records per-frame metrics (frame time, FPS, draw call proxies) and exposes
// them via a console-accessible API + optional on-screen overlay.
// Designed for Chrome DevTools remote debugging on mid-range mobile devices.

export interface FrameSample {
  /** Frame timestamp (ms, from performance.now()). */
  ts: number;
  /** Frame duration in ms. */
  frameTime: number;
  /** Instantaneous FPS (1000 / frameTime). */
  fps: number;
  /** Number of gem bodies drawn this frame. */
  gemCount: number;
  /** Canvas backing store total pixels (width × height). */
  canvasPixels: number;
  /** Effective (capped) device pixel ratio at time of sample. */
  dpr: number;
  /** Raw device pixel ratio (uncapped). */
  rawDpr: number;
}

const SAMPLE_BUFFER_SIZE = 3700; // ~60s at 60fps
const samples: FrameSample[] = [];
let lastFrameTs = 0;
let profilingActive = false;

/** Start collecting frame samples. */
export function startProfiling(): void {
  samples.length = 0;
  lastFrameTs = 0;
  profilingActive = true;
  console.log('[PerfProfiler] Started — call window.__perfReport() for summary');
}

/** Stop collecting. */
export function stopProfiling(): void {
  profilingActive = false;
  console.log(`[PerfProfiler] Stopped — ${samples.length} samples collected`);
}

/** Call once per render frame with canvas dimensions. */
export function recordFrame(canvas: HTMLCanvasElement, gemCount: number): void {
  if (!profilingActive) return;

  const now = performance.now();

  if (lastFrameTs > 0) {
    const frameTime = now - lastFrameTs;
    const rawDpr = window.devicePixelRatio || 1;
    // Effective DPR = actual canvas pixels / virtual resolution
    const effectiveDpr = canvas.width / 1280; // approximation from backing store
    const sample: FrameSample = {
      ts: now,
      frameTime,
      fps: 1000 / frameTime,
      gemCount,
      canvasPixels: canvas.width * canvas.height,
      dpr: Math.round(effectiveDpr * 100) / 100,
      rawDpr,
    };
    samples.push(sample);
    if (samples.length > SAMPLE_BUFFER_SIZE) samples.shift();
  }
  lastFrameTs = now;
}

/** Report type returned by generateReport(). */
export interface PerfReport {
  sampleCount: number;
  durationMs: number;
  dpr: number;
  rawDpr: number;
  canvasPixels: number;
  canvasResolution: string;
  avgFps: number;
  minFps: number;
  maxFps: number;
  p5Fps: number;
  p1Fps: number;
  avgFrameTime: number;
  maxFrameTime: number;
  droppedFrames: number;
  droppedFramePct: number;
  avgGemCount: number;
  bottlenecks: string[];
}

/** Generate a summary report from collected samples. */
export function generateReport(): PerfReport | null {
  if (samples.length < 10) return null;

  const sorted = [...samples].sort((a, b) => a.fps - b.fps);
  const n = sorted.length;
  const duration = samples[n - 1].ts - samples[0].ts;

  const avgFps = samples.reduce((s, f) => s + f.fps, 0) / n;
  const minFps = sorted[0].fps;
  const maxFps = sorted[n - 1].fps;
  const p5Fps = sorted[Math.floor(n * 0.05)].fps;
  const p1Fps = sorted[Math.floor(n * 0.01)].fps;

  const avgFrameTime = samples.reduce((s, f) => s + f.frameTime, 0) / n;
  const maxFrameTime = Math.max(...samples.map((f) => f.frameTime));
  const droppedFrames = samples.filter((f) => f.frameTime > 18).length; // >18ms = missed 60fps
  const avgGemCount = samples.reduce((s, f) => s + f.gemCount, 0) / n;

  const lastSample = samples[n - 1];
  const dpr = lastSample.dpr;
  const rawDpr = lastSample.rawDpr;
  const canvasPixels = lastSample.canvasPixels;
  const canvasW = Math.round(Math.sqrt(canvasPixels * (1280 / 720)));
  const canvasH = Math.round(canvasPixels / canvasW);

  // Identify bottlenecks
  const bottlenecks: string[] = [];

  if (rawDpr > dpr) {
    bottlenecks.push(
      `DPR CAPPED: device=${rawDpr} → effective=${dpr}. ` +
      `Canvas reduced from ${((1280 * rawDpr * 720 * rawDpr) / 1e6).toFixed(1)}M to ${(canvasPixels / 1e6).toFixed(1)}M pixels.`
    );
  } else if (dpr > 2) {
    bottlenecks.push(
      `HIGH DPR (${dpr}): canvas backing store is ${canvasPixels.toLocaleString()} pixels — ` +
      `${(canvasPixels / 1e6).toFixed(1)}M pixels cleared+redrawn every frame. ` +
      `Capping DPR to 2 would reduce to ${((1280 * 2) * (720 * 2)).toLocaleString()} pixels (${((1280 * 2 * 720 * 2) / 1e6).toFixed(1)}M).`
    );
  }

  if (canvasPixels > 4_000_000) {
    bottlenecks.push(
      `LARGE CANVAS: ${(canvasPixels / 1e6).toFixed(1)}M pixel backing store. ` +
      `Every clearRect + fill operation scales linearly with pixel count. ` +
      `On mobile GPUs this dominates frame budget.`
    );
  }

  // No shadowBlur in codebase, but note this for the optimization plan
  bottlenecks.push(
    `NO SHADOW BLUR USED: The renderer uses manual arc fills for shadows (not ctx.shadowBlur). ` +
    `However, the per-gem draw cost is 3 draw calls each (body + border stroke + inner highlight), ` +
    `which at ${Math.round(avgGemCount)} gems/frame = ~${Math.round(avgGemCount * 3)} canvas operations. ` +
    `Pre-rendering gems to offscreen canvases (sprite cache exists but is unused by renderer) ` +
    `would reduce this to 1 drawImage per gem.`
  );

  if (avgGemCount > 15) {
    bottlenecks.push(
      `HIGH GEM COUNT (avg ${Math.round(avgGemCount)}): Each gem triggers 3 canvas draw calls. ` +
      `Combined with high DPR this compounds fill-rate pressure.`
    );
  }

  // Gradient created every frame
  bottlenecks.push(
    `PER-FRAME GRADIENT: createLinearGradient() called every render frame for the preview panel. ` +
    `Should be cached once and reused.`
  );

  // Board/HUD redrawn from scratch
  bottlenecks.push(
    `NO LAYER CACHING: Board background, HUD, and preview panel are redrawn from scratch ` +
    `every frame even though they're mostly static. Offscreen canvas caching would help.`
  );

  if (droppedFrames > n * 0.1) {
    bottlenecks.push(
      `FRAME DROPS: ${droppedFrames}/${n} frames (${((droppedFrames / n) * 100).toFixed(1)}%) ` +
      `exceeded 16.67ms budget. Likely GPU fill-rate bound on mobile.`
    );
  }

  return {
    sampleCount: n,
    durationMs: duration,
    dpr,
    rawDpr,
    canvasPixels,
    canvasResolution: `${canvasW}×${canvasH}`,
    avgFps,
    minFps,
    maxFps,
    p5Fps,
    p1Fps,
    avgFrameTime,
    maxFrameTime,
    droppedFrames,
    droppedFramePct: (droppedFrames / n) * 100,
    avgGemCount,
    bottlenecks,
  };
}

/** Print a formatted report to the console. */
export function printReport(): void {
  const r = generateReport();
  if (!r) {
    console.log('[PerfProfiler] Not enough samples — play for a few seconds first');
    return;
  }

  console.log(
    `%c[PerfProfiler] Mobile Performance Report`,
    'font-weight:bold;font-size:14px;color:#4FC3F7',
  );
  console.log(`Duration: ${(r.durationMs / 1000).toFixed(1)}s (${r.sampleCount} frames)`);
  const dprInfo = r.rawDpr > r.dpr ? `DPR: ${r.rawDpr} → capped ${r.dpr}` : `DPR: ${r.dpr}`;
  console.log(`${dprInfo} → canvas ${r.canvasResolution} (${(r.canvasPixels / 1e6).toFixed(1)}M pixels)`);
  console.log(`FPS: avg=${r.avgFps.toFixed(1)} min=${r.minFps.toFixed(1)} p5=${r.p5Fps.toFixed(1)} p1=${r.p1Fps.toFixed(1)}`);
  console.log(`Frame time: avg=${r.avgFrameTime.toFixed(2)}ms max=${r.maxFrameTime.toFixed(2)}ms`);
  console.log(`Dropped frames (>18ms): ${r.droppedFrames} (${r.droppedFramePct.toFixed(1)}%)`);
  console.log(`Avg gem count: ${r.avgGemCount.toFixed(1)}`);
  console.log(`\n%cBottlenecks identified:`, 'font-weight:bold;color:#FF7043');
  r.bottlenecks.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
}

/** Draw a compact FPS/frame-time overlay in the top-right corner. */
export function drawPerfOverlay(ctx: CanvasRenderingContext2D): void {
  if (!profilingActive || samples.length < 2) return;

  const last = samples[samples.length - 1];
  const recent = samples.slice(-60);
  const avgFps = recent.reduce((s, f) => s + f.fps, 0) / recent.length;
  const maxFt = Math.max(...recent.map((f) => f.frameTime));

  ctx.save();
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(1280 - 200, 0, 200, 70);

  // FPS color: green > 55, yellow > 30, red otherwise
  const fpsColor = avgFps > 55 ? '#4CAF50' : avgFps > 30 ? '#FFC107' : '#F44336';
  ctx.fillStyle = fpsColor;
  ctx.fillText(`FPS: ${avgFps.toFixed(1)} (${last.fps.toFixed(0)})`, 1280 - 8, 6);

  ctx.fillStyle = '#E0E0E0';
  ctx.fillText(`Frame: ${last.frameTime.toFixed(1)}ms (max ${maxFt.toFixed(1)})`, 1280 - 8, 22);
  const dprLabel = last.rawDpr > last.dpr ? `DPR: ${last.rawDpr}→${last.dpr}` : `DPR: ${last.dpr}`;
  ctx.fillText(`${dprLabel} | ${(last.canvasPixels / 1e6).toFixed(1)}M px`, 1280 - 8, 38);
  ctx.fillText(`Gems: ${last.gemCount} | Q: ${getQualityTier()}`, 1280 - 8, 54);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Automated 60-second stress test
// ---------------------------------------------------------------------------
// Collects 60s of frame data and prints a pass/fail verification report.
// Run via console: __perfStressTest()

let stressTestTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Run a 60-second profiling session and print a verification report.
 * During this time, play the game normally (drop gems, trigger merges).
 * The test auto-stops and prints results after 60s.
 * @param durationSec  Test duration in seconds (default 60).
 */
export function runStressTest(durationSec = 60): void {
  // Reset and start fresh
  samples.length = 0;
  lastFrameTs = 0;
  profilingActive = true;

  console.log(
    `%c[PerfProfiler] Stress test started — ${durationSec}s`,
    'font-weight:bold;font-size:14px;color:#4FC3F7',
  );
  console.log('Play the game normally. Test will auto-stop and report results.');

  if (stressTestTimer) clearTimeout(stressTestTimer);
  stressTestTimer = setTimeout(() => {
    profilingActive = false;
    stressTestTimer = null;
    printVerificationReport(durationSec);
  }, durationSec * 1000);
}

/** Print pass/fail verification against 60 FPS target. */
function printVerificationReport(targetDuration: number): void {
  const r = generateReport();
  if (!r) {
    console.log('[PerfProfiler] Test failed — not enough samples collected');
    return;
  }

  const durationS = r.durationMs / 1000;
  const passAvgFps = r.avgFps >= 58;        // allow 2fps margin
  const passP5Fps = r.p5Fps >= 50;          // 95th percentile above 50
  const passP1Fps = r.p1Fps >= 40;          // 99th percentile above 40
  const passDropped = r.droppedFramePct < 5; // <5% dropped frames
  const passAll = passAvgFps && passP5Fps && passP1Fps && passDropped;

  console.log(
    `\n%c[PerfProfiler] ══════════ VERIFICATION REPORT ══════════`,
    'font-weight:bold;font-size:14px;color:#4FC3F7',
  );
  console.log(`Duration: ${durationS.toFixed(1)}s / ${targetDuration}s target (${r.sampleCount} frames)`);
  console.log(`Quality tier: ${getQualityTier()}`);
  const dprInfo = r.rawDpr > r.dpr ? `${r.rawDpr} → capped ${r.dpr}` : `${r.dpr}`;
  console.log(`DPR: ${dprInfo} → canvas ${r.canvasResolution} (${(r.canvasPixels / 1e6).toFixed(1)}M px)`);
  console.log(`Avg gem count: ${r.avgGemCount.toFixed(1)}`);

  console.log(`\n%cFPS Results:`, 'font-weight:bold');
  console.log(`  Avg FPS:     ${r.avgFps.toFixed(1)} ${passAvgFps ? '✓ PASS (≥58)' : '✗ FAIL (<58)'}`);
  console.log(`  P5 FPS:      ${r.p5Fps.toFixed(1)} ${passP5Fps ? '✓ PASS (≥50)' : '✗ FAIL (<50)'}`);
  console.log(`  P1 FPS:      ${r.p1Fps.toFixed(1)} ${passP1Fps ? '✓ PASS (≥40)' : '✗ FAIL (<40)'}`);
  console.log(`  Min FPS:     ${r.minFps.toFixed(1)}`);
  console.log(`  Dropped:     ${r.droppedFrames}/${r.sampleCount} (${r.droppedFramePct.toFixed(1)}%) ${passDropped ? '✓ PASS (<5%)' : '✗ FAIL (≥5%)'}`);

  console.log(`\n%cFrame time:`, 'font-weight:bold');
  console.log(`  Avg:         ${r.avgFrameTime.toFixed(2)}ms`);
  console.log(`  Max:         ${r.maxFrameTime.toFixed(2)}ms`);
  console.log(`  Budget:      16.67ms (60 FPS)`);

  console.log(
    `\n%c  OVERALL: ${passAll ? '✓ PASS — 60 FPS target met' : '✗ FAIL — 60 FPS target not met'}`,
    `font-weight:bold;font-size:16px;color:${passAll ? '#4CAF50' : '#F44336'}`,
  );
  console.log(`%c══════════════════════════════════════════`, 'color:#4FC3F7');
}

// Expose to console for remote debugging
import { setMaxDpr, setPixelBudget, setQualityTier, getQualityTier } from './renderConfig';
if (typeof window !== 'undefined') {
  (window as any).__perfStart = startProfiling;
  (window as any).__perfStop = stopProfiling;
  (window as any).__perfReport = printReport;
  (window as any).__perfData = () => generateReport();
  (window as any).__setMaxDpr = setMaxDpr;
  (window as any).__setPixelBudget = setPixelBudget;
  (window as any).__setQuality = setQualityTier;  // __setQuality('low'|'medium'|'high')
  (window as any).__getQuality = getQualityTier;
  (window as any).__perfStressTest = runStressTest; // __perfStressTest(60)
}
