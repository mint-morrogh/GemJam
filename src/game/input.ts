import { screenToVirtual } from '../canvas';

// ---------------------------------------------------------------------------
// Aim state — read each frame by the renderer for trajectory drawing
// ---------------------------------------------------------------------------

export interface AimState {
  /** Current aim X in virtual coordinates. */
  x: number;
  /** Current aim Y in virtual coordinates. */
  y: number;
  /** True when the player is actively aiming (mouse over canvas / finger down). */
  active: boolean;
}

// ---------------------------------------------------------------------------
// Input handler interface
// ---------------------------------------------------------------------------

export interface InputHandler {
  /** Read-only aim position (follows mouse / first finger). */
  readonly aim: Readonly<AimState>;
  /** Callback fired when the player fires (left-click on PC, second-finger tap on mobile). */
  onFire: ((aimX: number, aimY: number) => void) | null;
  /** Remove all event listeners. */
  destroy: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create unified input handler for the launcher aiming system.
 *
 * **PC (mouse):** Aim follows cursor continuously. Left-click fires.
 * **Mobile (touch):** First finger aims. Second finger tap fires.
 *   Lifting the aiming finger cancels (does not fire).
 */
export function createInputHandler(canvas: HTMLCanvasElement): InputHandler {
  canvas.style.touchAction = 'none';

  const aim: AimState = { x: 0, y: 0, active: false };
  let onFire: InputHandler['onFire'] = null;

  /** Touch identifier of the aiming finger (first finger). */
  let aimTouchId: number | null = null;

  // --- Mouse (Pointer Events) ------------------------------------------------

  function handlePointerMove(e: PointerEvent): void {
    if (e.pointerType === 'touch') return; // touch handled separately
    const vp = screenToVirtual(canvas, e.clientX, e.clientY);
    aim.x = vp.x;
    aim.y = vp.y;
    aim.active = true;
  }

  function handlePointerDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') return;
    if (e.button !== 0) return; // left-click only
    const vp = screenToVirtual(canvas, e.clientX, e.clientY);
    aim.x = vp.x;
    aim.y = vp.y;
    onFire?.(aim.x, aim.y);
  }

  // --- Touch Events ----------------------------------------------------------

  function handleTouchStart(e: TouchEvent): void {
    e.preventDefault();

    if (aimTouchId === null) {
      // First finger → start aiming
      const touch = e.changedTouches[0];
      aimTouchId = touch.identifier;
      const vp = screenToVirtual(canvas, touch.clientX, touch.clientY);
      aim.x = vp.x;
      aim.y = vp.y;
      aim.active = true;
    } else {
      // Second finger while aiming → FIRE (keep aiming with first finger)
      onFire?.(aim.x, aim.y);
    }
  }

  function handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (aimTouchId === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === aimTouchId) {
        const vp = screenToVirtual(canvas, touch.clientX, touch.clientY);
        aim.x = vp.x;
        aim.y = vp.y;
        break;
      }
    }
  }

  function handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    if (aimTouchId === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === aimTouchId) {
        // Aiming finger lifted → cancel aim (don't fire)
        aimTouchId = null;
        aim.active = false;
        return;
      }
    }
  }

  function handleTouchCancel(_e: TouchEvent): void {
    aimTouchId = null;
    aim.active = false;
  }

  // --- Visibility guard ------------------------------------------------------

  function handleVisibilityChange(): void {
    if (document.hidden) {
      aimTouchId = null;
      aim.active = false;
    }
  }

  // --- Register listeners ----------------------------------------------------

  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false });
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return {
    get aim() { return aim; },
    get onFire() { return onFire; },
    set onFire(fn) { onFire = fn; },
    destroy() {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchCancel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    },
  };
}
