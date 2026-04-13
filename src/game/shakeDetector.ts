// ---------------------------------------------------------------------------
// Shake detector — robust mobile shake detection for web browsers
// ---------------------------------------------------------------------------
// Inspired by alexgibson/shake.js but TS-native. Uses delta-based detection
// between consecutive accelerometer readings — sidesteps the gravity-baseline
// problem that magnitude-minus-9.8 approaches have.
//
// Also handles:
//   - iOS 13+ DeviceMotionEvent.requestPermission() (must run in user gesture)
//   - Insecure-context detection (HTTPS required on recent iOS/Chrome)
//   - Always-on event counter for diagnostics
// ---------------------------------------------------------------------------

export type ShakeStatus =
  | 'uninitialized'      // init() not yet called
  | 'unsupported'        // DeviceMotionEvent not available at all
  | 'awaiting-permission' // iOS: waiting for user to grant permission
  | 'permission-denied'  // iOS: user explicitly tapped "Don't Allow"
  | 'gesture-required'   // iOS: call threw — wasn't in a valid user gesture. Retry from a button.
  | 'listening'          // listener attached, events flowing (or should be)
  | 'insecure-context';  // not HTTPS/localhost — likely blocked on iOS

interface ShakeState {
  status: ShakeStatus;
  /** Monotonic count of devicemotion events since page load. Nonzero = sensor alive. */
  eventCount: number;
  /** Current delta magnitude (sum of abs deltas across x/y/z between last two samples). */
  currentDelta: number;
  /** Peak delta seen since last reset. */
  peakDelta: number;
  /** Raw magnitude including gravity (for sanity-check — should be ~9.8 at rest). */
  rawMagnitude: number;
  /** Instantaneous shake "strength" 0..1 smoothed from currentDelta. */
  shakeLevel: number;
}

const state: ShakeState = {
  status: 'uninitialized',
  eventCount: 0,
  currentDelta: 0,
  peakDelta: 0,
  rawMagnitude: 0,
  shakeLevel: 0,
};

// Last reading for delta computation
let lastX = 0, lastY = 0, lastZ = 0, hasLast = false;
// Smoothing for shakeLevel
let smoothed = 0;

const SHAKE_THRESHOLD = 2; // delta magnitude above noise floor
const SHAKE_MAX = 15;      // delta mag that saturates shakeLevel to 1.0 — small so moderate shakes hit full strength

function handleMotion(e: DeviceMotionEvent): void {
  state.eventCount++;

  // Prefer `acceleration` (no gravity) when available — more accurate for shake.
  // Fall back to accelerationIncludingGravity and rely on delta math.
  const useNoGravity = e.acceleration && e.acceleration.x !== null;
  const src = useNoGravity ? e.acceleration! : e.accelerationIncludingGravity;
  if (!src) return;

  const x = src.x ?? 0;
  const y = src.y ?? 0;
  const z = src.z ?? 0;

  state.rawMagnitude = Math.sqrt(x * x + y * y + z * z);

  if (hasLast) {
    const dx = Math.abs(x - lastX);
    const dy = Math.abs(y - lastY);
    const dz = Math.abs(z - lastZ);
    state.currentDelta = dx + dy + dz;
    if (state.currentDelta > state.peakDelta) state.peakDelta = state.currentDelta;

    // Smooth shake level for UI / gravity driving — weighted toward responsive new samples
    const instant = Math.min(1, Math.max(0, (state.currentDelta - SHAKE_THRESHOLD) / SHAKE_MAX));
    smoothed = smoothed * 0.35 + instant * 0.65;
    state.shakeLevel = smoothed;
  }

  lastX = x; lastY = y; lastZ = z;
  hasLast = true;
}

function attachListener(): void {
  if (state.status === 'listening') return;
  window.addEventListener('devicemotion', handleMotion);
  state.status = 'listening';
}

/** Detect if we're in a secure context (HTTPS or localhost). */
function isSecure(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as any).isSecureContext) return true;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

/**
 * Initialize shake detection. Safe to call at module load — does NOT trigger
 * an iOS permission prompt (which must come from a user gesture).
 */
export function initShake(): void {
  if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') {
    state.status = 'unsupported';
    return;
  }

  // Secure-context check — iOS Safari silently refuses devicemotion on http://
  if (!isSecure()) {
    // We'll still attempt to attach, but mark the status so the UI can warn.
    // iOS will simply never fire events; Android may still work.
    state.status = 'insecure-context';
    console.warn(
      '[shake] Not a secure context (HTTPS/localhost required). ' +
        'iOS Safari will block devicemotion events. Use an HTTPS tunnel for mobile testing.',
    );
  }

  const DME = DeviceMotionEvent as any;
  if (typeof DME.requestPermission === 'function') {
    // iOS 13+ — defer until requestPermission() is called from user gesture.
    if (state.status !== 'insecure-context') state.status = 'awaiting-permission';
    return;
  }

  // Android/others: attach immediately.
  attachListener();
}

/**
 * Request iOS motion permission. MUST be called synchronously from a user
 * gesture handler. Returns true if permission is granted (or not needed).
 */
export async function requestShakePermission(): Promise<boolean> {
  if (state.status === 'unsupported') return false;
  if (state.status === 'listening') return true;

  const DME = DeviceMotionEvent as any;
  if (typeof DME.requestPermission !== 'function') {
    attachListener();
    return true;
  }

  try {
    const result = await DME.requestPermission();
    if (result === 'granted') {
      attachListener();
      return true;
    }
    // User tapped "Don't Allow" — iOS won't re-prompt until Safari data cleared.
    state.status = 'permission-denied';
  } catch (err) {
    // Most common cause: not called from a valid user gesture (e.g. called
    // from a timer or asynchronously after an event). Distinguish this from
    // a real denial so the UI can prompt "tap the Enable Motion button".
    state.status = 'gesture-required';
    console.warn('[shake] requestPermission threw — likely not in user gesture:', err);
  }
  return false;
}

export function getShakeInfo(): Readonly<ShakeState> {
  return state;
}

/** Reset peak counter (e.g. at the start of a shake phase). */
export function resetShakePeak(): void {
  state.peakDelta = 0;
}
