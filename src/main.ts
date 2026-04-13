import './style.css';
import { createCanvas, initResize, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from './canvas';
import { createWorld, createStaticRect, createCornerArc as createCornerArcBodies, dynamicBodies, bodyPos, bodyVel, setVelocity, setAngularVelocity } from './physics/planckWorld';
import { startLoop, getStats, FIXED_DT } from './engine/gameLoop';
import { drawPhysicsGems, drawGemShimmers, drawNextGemPanel, drawDangerZone, drawScoreHUD, drawLauncherGem, drawTrajectory, drawShakeLid, triggerQueueShift, updateQueueAnimation, resetQueueAnimation } from './game/renderer';
import { renderGameOver, installGameOverClickHandler, startGameOverAnim, updateGameOverAnim, resetGameOverAnim } from './game/gameOverScreen';
import { createInputHandler } from './game/input';
import { createGameState, consumeNextGem, checkOverflow, resetGameState, getDangerLevel } from './game/state';
import { GRID, GEM_TIERS } from './game/gems';
import { spawnGem, getGemData } from './game/gemSpawner';
import { initMergeSystem, processMerges } from './game/mergeSystem';
import { updateAndDrawMergeAnimations, resetMergeAnimations, getScreenShake } from './game/mergeAnimation';
import { resetMergeQueue } from './game/mergeDetector';
import { particles, detectLandings, resetLandingTracker, updateGemSparkles } from './game/particles';
import { setOnMerge } from './game/mergeExecutor';
import { createScoringState, awardMergePoints, registerMerge, updateCombo, goldComboMultiplierFor, BASE_MULTIPLIER, loadHighScore, saveHighScore, recordScore } from './game/scoring';
import type { ScoreEntry } from './game/scoring';
import { createLauncherState, getLaunchVelocity, computeTrajectory } from './game/launcher';
import { loadSettings, getSettings } from './game/settings';
import { screenToVirtual } from './canvas';
import { startProfiling, recordFrame, drawPerfOverlay } from './game/perfProfiler';
import { autoDetectQuality, feedFrameTime, updateTransition, shouldRenderEffects } from './game/renderConfig';
import { getBoardCache } from './game/boardCache';
import { writeSave, readSave, clearSave } from './game/persistence';
import { initShakeDetection, ensureMotionPermission, checkLevelUp, updateLevelShake, getShakeGravity, getShakePhase, getCurrentLevel, pointsToNextLevel, getLidProgress, resetLevelShake, setLevel, closeShopPhase, drawLevelOverlay } from './game/levelShake';
import { isDropdownOpen, toggleDropdown, closeDropdown, updateDropdown, isClickInNav, isClickOnRestart, isClickOnBackdrop, handleAutoShakeToggle, handleFireModeToggle, drawDropdown } from './game/dropdown';
import { getGold, addGold, goldForTier, spawnGoldText, spawnScoreText, spawnFloatingLabel, updateFloatingText, drawFloatingText, openShop, closeShop, clearShopForNextLevel, isShopOpen, buyItem, rerollShop, getShopClickIndex, isClickOnContinue, isClickOnReroll, drawShop, resetShop, getShopSaveData, restoreShopData } from './game/shop';
import { setOnBlackhole, resetBlackholeTracker, updateBlackholes, drawActiveBlackholes } from './game/blackhole';
import type { SaveData, GemSnapshot } from './game/persistence';
import { drawPauseOverlay } from './game/renderer';

// -- Render quality auto-detection (before canvas so DPR cap applies) -------
const detectedTier = autoDetectQuality();
console.log(`[RenderConfig] Quality tier: ${detectedTier} (cores=${navigator.hardwareConcurrency || '?'}, dpr=${window.devicePixelRatio})`);

// -- Canvas setup (virtual-resolution, DPR-scaled) --------------------------
const { canvas, ctx } = createCanvas();
document.getElementById('app')?.appendChild(canvas)
  ?? document.body.appendChild(canvas);

initResize(canvas, ctx);

// -- Rotate-device prompt (shown on mobile landscape via CSS) ---------------
const rotatePrompt = document.createElement('div');
rotatePrompt.id = 'rotate-prompt';
rotatePrompt.innerHTML =
  '<div class="rotate-icon">&#x21BB;</div>' +
  '<div class="rotate-text">Rotate your device to portrait</div>';
document.body.appendChild(rotatePrompt);

// -- Load persisted settings ------------------------------------------------
loadSettings();
initShakeDetection();

// iOS 13+ requires requestPermission() from a user gesture. Request on the
// first tap/click anywhere — guaranteed user-gesture context.
const firstTapMotionHook = () => {
  ensureMotionPermission();
  window.removeEventListener('pointerdown', firstTapMotionHook);
  window.removeEventListener('touchstart', firstTapMotionHook);
};
window.addEventListener('pointerdown', firstTapMotionHook, { once: false });
window.addEventListener('touchstart', firstTapMotionHook, { once: false });

// Warn if not in secure context — devicemotion is blocked on http:// for many
// modern browsers (iOS Safari especially).
if (typeof window !== 'undefined' && !window.isSecureContext && ('ontouchstart' in window)) {
  console.warn('[GemJam] Page is NOT a secure context (HTTPS/localhost). Device motion sensors may be disabled by the browser. Serve over HTTPS for mobile shake detection.');
}

// -- Planck.js (Box2D) physics world ----------------------------------------
const world = createWorld(25); // gravity 25 m/s² — snappy game feel

// Container walls (bottom, left, right — no top so gems drop in)
const WALL_T = 50;
const { containerX: CX, containerY: CY, containerWidth: CW, containerHeight: CH } = GRID;
const wallOpts = { friction: 0.4, restitution: 0.1 };

createStaticRect(world, CX + CW / 2, CY + CH + WALL_T / 2, CW + WALL_T * 2, WALL_T, wallOpts);
createStaticRect(world, CX - WALL_T / 2, CY + CH / 2, WALL_T, CH + WALL_T, wallOpts);
createStaticRect(world, CX + CW + WALL_T / 2, CY + CH / 2, WALL_T, CH + WALL_T, wallOpts);

// Rounded bottom corners (edge chain arcs)
const PHYS_CORNER_R = 45;
createCornerArcBodies(world, CX + PHYS_CORNER_R, CY + CH - PHYS_CORNER_R, PHYS_CORNER_R, Math.PI / 2, Math.PI, 12, wallOpts);
createCornerArcBodies(world, CX + CW - PHYS_CORNER_R, CY + CH - PHYS_CORNER_R, PHYS_CORNER_R, 0, Math.PI / 2, 12, wallOpts);

// -- Merge system -----------------------------------------------------------
initMergeSystem(world);

// -- Scoring ----------------------------------------------------------------
const scoring = createScoringState(loadHighScore());
let elapsedTime = 0;

setOnMerge((resultTier, _rainbow, midX, midY, bonusMerge, tierSkipped, bonusGemSpawned, exploded) => {
  registerMerge(scoring, elapsedTime);

  const scoreTier = resultTier === -1 ? 11 : resultTier;
  const combo = scoring.comboCount;
  const basePts = awardMergePoints(scoring, scoreTier);
  const gemR = GEM_TIERS[scoreTier]?.radius ?? 30;

  // Score popup (offset above the merged gem's top edge)
  const totalPts = bonusMerge ? basePts * 5 : basePts;
  if (totalPts > 0) spawnScoreText(midX, midY - gemR - 28, totalPts, combo);

  // Bonus gem: 5x score (award the extra 4x on top)
  if (bonusMerge && basePts > 0) {
    scoring.score += basePts * 4;
  }

  // Gold reward (spaced below score text)
  const goldComboMult = goldComboMultiplierFor(combo);
  const goldAmt = Math.round(goldForTier(scoreTier) * (bonusMerge ? 5 : 1) * goldComboMult);
  addGold(goldAmt);
  spawnGoldText(midX, midY - gemR - 8, goldAmt);

  // Special event announcements — stacked above score/gold text
  // Score is at gemR+28, gold at gemR+8, so events start at gemR+48 and stack up
  let eventOffset = gemR + 48;

  if (tierSkipped) {
    spawnFloatingLabel(midX, midY - eventOffset, 'TIER SKIP!', '#67E8F9', 1.2, 16);
    eventOffset += 18;
  }

  if (bonusGemSpawned) {
    spawnFloatingLabel(midX, midY - eventOffset, 'BONUS GEM!', '#4ADE80', 1.2, 16);
    eventOffset += 18;
  }

  if (exploded) {
    spawnFloatingLabel(midX, midY - eventOffset, 'BOOM!', '#FF6B2D', 1.0, 18);
    eventOffset += 18;
  }

  // Track run stats
  state.mergeCount++;
  if (scoreTier > state.peakTier) state.peakTier = scoreTier;
  if (scoring.comboCount > state.maxCombo) state.maxCombo = scoring.comboCount;
});

// -- Black hole callback ----------------------------------------------------
setOnBlackhole((tier, absorbed, totalPoints, x, y) => {
  scoring.score += totalPoints;
  const goldAmt = goldForTier(tier) * (absorbed + 1);
  addGold(goldAmt);
  spawnFloatingLabel(x, y - 30, `BLACK HOLE! x${absorbed + 1}`, '#C084FC', 1.5);
  spawnGoldText(x, y - 10, goldAmt);
});

// -- Game state (preview gem + column-drop logic) ---------------------------
const state = createGameState();
const launcher = createLauncherState();
let fireCooldown = 0;
/** Temporary top wall during shake phase (keeps gems in the well). */
let shakeLid: import('planck').Body | null = null;

/** Accumulated time (seconds) that gems have continuously been above the top line. */
let overflowTimer = 0;
/** How long overflow must persist before triggering game over (seconds). */
const OVERFLOW_GRACE = 4;
/** Whether the current/last run set a new high score. */
let isNewHighScore = false;
/** Score history snapshot taken at game over. */
let gameOverHistory: ScoreEntry[] = [];
/** Rank of the current run in the leaderboard (-1 = didn't place). */
let gameOverRank = -1;
/** True when the game is paused (blur / visibility change). */
let paused = false;

// -- Save / Restore ---------------------------------------------------------

/** Gather all game state into a save snapshot. */
function gatherSave(): SaveData {
  const gems: GemSnapshot[] = [];
  const bodies = dynamicBodies(world);
  for (const body of bodies) {
    const d = getGemData(body);
    if (!d) continue;
    const pos = bodyPos(body);
    const vel = bodyVel(body);
    gems.push({
      x: pos.x, y: pos.y,
      vx: vel.x, vy: vel.y,
      tier: d.tier,
      rainbow: d.rainbow || undefined,
    });
  }
  return {
    version: 1,
    gems,
    queue: state.gemQueue.map((g) => g.def.id),
    score: scoring.score,
    highScore: scoring.highScore,
    comboCount: scoring.comboCount,
    comboMultiplier: scoring.comboMultiplier,
    bestCombo: scoring.bestCombo,
    lastMergeTime: scoring.lastMergeTime,
    elapsedTime,
    mergeCount: state.mergeCount,
    peakTier: state.peakTier,
    maxCombo: state.maxCombo,
    gameOver: state.gameOver,
    level: getCurrentLevel(),
    ...getShopSaveData(),
  };
}

/** Restore game from a save snapshot. */
function restoreFromSave(save: SaveData): void {
  // Remove any existing gem bodies
  for (const b of dynamicBodies(world)) {
    if (getGemData(b)) world.destroyBody(b);
  }

  // Recreate gem bodies from snapshots
  for (const g of save.gems) {
    const body = spawnGem(world, g.x, g.y, g.tier, g.rainbow ?? false);
    setVelocity(body, g.vx, g.vy);
  }

  // Restore queue
  state.gemQueue.length = 0;
  for (const tid of save.queue) {
    const def = GEM_TIERS[tid];
    if (def) state.gemQueue.push({ def, heavy: false, bonus: false, blackhole: false });
  }

  // Restore scoring
  scoring.score = save.score;
  scoring.highScore = save.highScore;
  scoring.comboCount = save.comboCount;
  scoring.comboMultiplier = save.comboMultiplier;
  scoring.bestCombo = save.bestCombo;
  scoring.lastMergeTime = save.lastMergeTime;

  // Restore run stats
  elapsedTime = save.elapsedTime;
  state.mergeCount = save.mergeCount;
  state.peakTier = save.peakTier;
  state.maxCombo = save.maxCombo;
  state.gameOver = save.gameOver;

  fireCooldown = 0;
  overflowTimer = 0;

  // Restore level
  if (save.level && save.level > 1) setLevel(save.level);
  restoreShopData(save as any);
}

// Try to restore a previous session on load
const pendingSave = readSave();
if (pendingSave && !pendingSave.gameOver) {
  restoreFromSave(pendingSave);
  paused = true; // start paused so player can orient
  console.log(`[Persistence] Restored ${pendingSave.gems.length} gems, score ${pendingSave.score}`);
}

// -- Auto-save + auto-pause on blur / visibility change ---------------------
function autoSaveAndPause(): void {
  if (state.gameOver) return;
  paused = true;
  writeSave(gatherSave());
}

window.addEventListener('blur', autoSaveAndPause);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) autoSaveAndPause();
});
window.addEventListener('beforeunload', () => {
  if (!state.gameOver) writeSave(gatherSave());
});

// -- Resume on tap / click (capture phase — consumed before input handler) --
let resumeCooldown = 0;
function handleResume(e: Event): void {
  if (!paused) return;
  paused = false;
  resumeCooldown = 0.3; // block firing for 300ms after resume
  e.stopImmediatePropagation();
  e.preventDefault();
}
canvas.addEventListener('pointerdown', handleResume, { capture: true });
canvas.addEventListener('touchstart', handleResume, { capture: true });

// -- Restart ----------------------------------------------------------------
/** Remove all gem bodies from the physics world, reset state, clear allGems. */
function restartGame(): void {
  clearSave();

  // Remove ALL gem bodies from Planck world
  for (const b of dynamicBodies(world)) {
    if (getGemData(b)) world.destroyBody(b);
  }

  // Reset game state (columns, queue, gameOver flag, mergeCount/peakTier/maxCombo)
  resetGameState(state);

  // Reset scoring (preserve high score)
  scoring.score = 0;
  scoring.comboCount = 0;
  scoring.comboMultiplier = BASE_MULTIPLIER;
  scoring.bestCombo = 0;
  scoring.lastMergeTime = -Infinity;
  elapsedTime = 0;
  isNewHighScore = false;
  gameOverHistory = [];
  gameOverRank = -1;

  // Reset local flags
  fireCooldown = 0;
  overflowTimer = 0;

  // Clear any in-flight queue shift animation
  resetQueueAnimation();

  // Reset game-over animation
  resetGameOverAnim();

  // Clear merge pipeline (queued merges + pending body set)
  resetMergeQueue();

  // Clear merge visual effects (scale-up + flash)
  resetMergeAnimations();

  // Clear all active particles and landing tracker
  particles.clear();
  resetLandingTracker();

  // Reset level system
  resetLevelShake();
  resetShop();
  resetBlackholeTracker();
}

// -- Play Again click detection (delegated to gameOverScreen module) --------
installGameOverClickHandler(canvas, () => state.gameOver, restartGame);

// -- Dropdown menu + nav bar click handling ----------------------------------
function handleMenuClick(clientX: number, clientY: number): void {
  const vp = screenToVirtual(canvas, clientX, clientY);

  // Shop clicks take priority
  if (isShopOpen()) {
    const idx = getShopClickIndex(vp.x, vp.y);
    if (idx >= 0) { buyItem(idx); return; }
    if (isClickOnReroll(vp.x, vp.y)) { rerollShop(); return; }
    if (isClickOnContinue(vp.x, vp.y)) { closeShop(); clearShopForNextLevel(); closeShopPhase(); return; }
    return;
  }

  if (isDropdownOpen()) {
    // Auto-shake toggle
    if (handleAutoShakeToggle(vp.x, vp.y)) return;
    if (handleFireModeToggle(vp.x, vp.y)) return;
    // Restart button
    if (isClickOnRestart(vp.x, vp.y)) {
      closeDropdown();
      restartGame();
      return;
    }
    // Backdrop or nav bar → close
    if (isClickOnBackdrop(vp.y) || isClickInNav(vp.y)) {
      closeDropdown();
      return;
    }
    return;
  }

  // Tap on nav bar → toggle dropdown (no pause)
  if (isClickInNav(vp.y) && !state.gameOver) {
    toggleDropdown();
    return;
  }
}

canvas.addEventListener('click', (e) => handleMenuClick(e.clientX, e.clientY));
canvas.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0];
  if (t) handleMenuClick(t.clientX, t.clientY);
});

// -- Input (aim + fire) -----------------------------------------------------
const input = createInputHandler(canvas);

input.onFire = (aimX, aimY) => {
  if (state.gameOver) return;
  if (fireCooldown > 0) return;
  if (resumeCooldown > 0) return;
  // Player can still fire during danger — countdown only resets when line is clear
  if (getShakePhase() !== 'playing') return;
  if (isDropdownOpen()) return;

  const vel = getLaunchVelocity(launcher, aimX, aimY);
  if (!vel) return;

  // Consume next gem from queue
  const spawn = consumeNextGem(state);
  const tierIndex = GEM_TIERS.indexOf(spawn.def);

  // Spawn physics body at launch point with initial velocity + random spin
  const body = spawnGem(world, launcher.launchX, launcher.launchY, tierIndex, false, spawn.heavy);
  if (spawn.bonus) { const d = getGemData(body); if (d) d.bonus = true; }
  if (spawn.blackhole) { const d = getGemData(body); if (d) d.blackhole = true; }
  setVelocity(body, vel.vx, vel.vy);
  setAngularVelocity(body, (Math.random() - 0.5) * 0.15);

  triggerQueueShift(spawn.def);
  fireCooldown = 0.35;
};

// -- Performance profiling (auto-start; use console __perfReport() for results)
startProfiling();

// -- Game loop: physics in update, drawing in render ------------------------
startLoop({
  update(_dt: number) {
    updateDropdown(_dt);
    if (paused) return;
    elapsedTime += _dt;
    fireCooldown = Math.max(0, fireCooldown - _dt);
    resumeCooldown = Math.max(0, resumeCooldown - _dt);

    // Level interlude state machine
    checkLevelUp(scoring.score);
    const interludeBlocks = updateLevelShake(_dt);

    // Seal the well during countdown + shake + settling
    const phase = getShakePhase();
    if ((phase === 'countdown' || phase === 'shaking' || phase === 'settling') && !shakeLid) {
      shakeLid = createStaticRect(world, CX + CW / 2, CY + WALL_T / 2, CW + WALL_T * 2, WALL_T, wallOpts);
    }
    if (phase === 'resume' || phase === 'playing') {
      if (shakeLid) { world.destroyBody(shakeLid); shakeLid = null; }
    }

    // Shake phase: oscillate gravity + loosen all bodies so they jostle freely
    const shakeGrav = getShakeGravity();
    if (shakeGrav) {
      world.setGravity({ x: shakeGrav.gx, y: shakeGrav.gy });
      for (const b of dynamicBodies(world)) {
        if (!getGemData(b)) continue;
        if (!b.isAwake()) b.setAwake(true);
        // Temporarily kill friction + damping so gems slide freely
        b.setLinearDamping(0);
        b.setAngularDamping(0.2);
        for (let f = b.getFixtureList(); f; f = f.getNext()) {
          f.setFriction(0.02);
          f.setRestitution(0.6);
        }
      }
    } else if (phase === 'settling') {
      // Restore normal gravity + body properties after shake
      world.setGravity({ x: 0, y: 25 });
      for (const b of dynamicBodies(world)) {
        const d = getGemData(b);
        if (!d) continue;
        const t = d.tier / (GEM_TIERS.length - 1);
        b.setLinearDamping(0.8 - t * 0.5);
        b.setAngularDamping(2.0 + t * 1.0);
        for (let f = b.getFixtureList(); f; f = f.getNext()) {
          f.setFriction(0.3 + t * 0.2);
          f.setRestitution(0.5 - t * 0.3);
        }
      }
    }

    // Skip physics + merges during banner/countdown/resume (but not during shake!)
    if (interludeBlocks) {
      // Still update particles and animations for visual continuity
      if (getSettings().showParticles) particles.update(_dt);
      updateTransition(_dt);
      updateQueueAnimation(_dt);
      return;
    }

    // Advance Planck physics (Box2D step)
    world.step(FIXED_DT);

    // Process queued merges
    processMerges(world);

    // Get dynamic bodies for post-step processing
    const allBods = dynamicBodies(world);

    // Detect gem landings
    detectLandings(allBods);

    // Idle sparkles on gem tiers 4+
    updateGemSparkles(_dt, allBods);
    updateBlackholes(_dt);
    updateFloatingText(_dt);

    // Open shop when phase transitions to 'shop'
    if (getShakePhase() === 'shop' && !isShopOpen()) openShop();

    // Expire combo window
    updateCombo(scoring, elapsedTime);

    // Queue shift animation
    updateQueueAnimation(_dt);

    // Particle system (respects showParticles setting)
    if (getSettings().showParticles) particles.update(_dt);

    // Smooth quality tier transition (glow intensity interpolation)
    updateTransition(_dt);

    // Game-over fade-in animation
    updateGameOverAnim(_dt);

    // Overflow detection
    if (!state.gameOver && checkOverflow(world)) {
      overflowTimer += _dt;
      if (overflowTimer >= OVERFLOW_GRACE) {
        state.gameOver = true;
        clearSave();
        resetShop(); // wipe all upgrades immediately — no lingering via blur/save
        isNewHighScore = saveHighScore(scoring);
        const result = recordScore(scoring);
        gameOverHistory = result.history;
        gameOverRank = result.rank;
        startGameOverAnim();
      }
    } else {
      overflowTimer = 0;
    }
  },

  render(_alpha: number) {
    // Feed frame time to adaptive effect skipper
    const { fps } = getStats();
    if (fps > 0) feedFrameTime(1000 / fps);

    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Screen shake offset (big merges)
    const shake = getScreenShake();
    if (shake.x || shake.y) {
      ctx.save();
      ctx.translate(shake.x, shake.y);
    }

    // Board background — blit from offscreen cache
    ctx.drawImage(getBoardCache(), 0, 0);

    drawNextGemPanel(ctx, state.gemQueue.slice(1));
    drawScoreHUD(ctx, scoring, getCurrentLevel(), pointsToNextLevel(scoring.score, getCurrentLevel()), getGold());

    // Danger zone indicator at top of container
    const danger = getDangerLevel(world);
    if (getSettings().showDangerWarning) drawDangerZone(ctx, danger, elapsedTime, overflowTimer / OVERFLOW_GRACE);

    // Shake lid (glass panels sliding shut/open)
    drawShakeLid(ctx, getLidProgress());

    // Trajectory line (behind gems, only while aiming)
    if (input.aim.active && !state.gameOver) {
      const vel = getLaunchVelocity(launcher, input.aim.x, input.aim.y);
      if (vel) {
        const nextDef = state.nextGem.def;
        const trajectory = computeTrajectory(
          launcher.launchX, launcher.launchY,
          vel.vx, vel.vy, nextDef.radius, nextDef.id,
        );
        drawTrajectory(ctx, trajectory, elapsedTime);
      }
    }

    // Determine if expensive effects should render this frame
    const renderEffects = shouldRenderEffects();

    // Draw gems from Planck physics world
    const bodies = dynamicBodies(world);
    drawPhysicsGems(ctx, bodies, renderEffects ? elapsedTime : -1);

    // Gem shimmers (twinkle stars on gem surfaces)
    if (renderEffects) drawGemShimmers(ctx);

    // Active black hole vortex animations
    drawActiveBlackholes(ctx, elapsedTime);

    // Merge animations (scale-up + flash)
    updateAndDrawMergeAnimations(ctx, FIXED_DT, renderEffects);

    // Particles (merge burst, landing dust, etc.)
    if (getSettings().showParticles && renderEffects) particles.render(ctx);

    // Launcher gem (on top of everything except overlays)
    if (!state.gameOver) {
      drawLauncherGem(ctx, launcher.launchX, launcher.launchY, state.nextGem.def, elapsedTime, state.nextGem.heavy, state.nextGem.bonus, state.nextGem.blackhole);
    }

    // End screen shake transform
    if (shake.x || shake.y) ctx.restore();

    // Floating gold text
    drawFloatingText(ctx);

    // Level interlude overlay (banner, countdown, shake)
    drawLevelOverlay(ctx, elapsedTime);

    // Shop overlay
    drawShop(ctx);

    // Dropdown menu (over everything except game-over/pause)
    drawDropdown(ctx, scoring.score, scoring.highScore, getCurrentLevel(), pointsToNextLevel(scoring.score, getCurrentLevel()));


    // Performance profiler — record frame and draw overlay
    const gemBodies = bodies.filter((b) => getGemData(b));
    recordFrame(canvas, gemBodies.length);
    drawPerfOverlay(ctx);

    // Game-over overlay
    if (state.gameOver) {
      renderGameOver(ctx, scoring, isNewHighScore, {
        mergeCount: state.mergeCount,
        peakTier: state.peakTier,
        maxCombo: state.maxCombo,
      }, gameOverHistory, gameOverRank);
    }

    // Pause overlay (on top of everything)
    if (paused) drawPauseOverlay(ctx);
  },
});
