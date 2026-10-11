"use client";

// One pointer gesture on the calendar: a tap, or a drag that starts once the mouse has moved a
// few pixels or a finger has been held still for a moment (so a finger can still scroll). Once a
// touch drag has started, the page stops scrolling under it: a non-passive touchmove listener
// cancels the browser's own panning, as dnd-kit's touch sensor does.

export type GestureHandlers = {
  /** The drag starts (after the threshold or the hold). Return false to not drag after all. */
  start: (x: number, y: number) => boolean | void;
  move: (x: number, y: number, e: PointerEvent) => void;
  end: (x: number, y: number, e: PointerEvent) => void;
  cancel: () => void;
  /** Released without dragging. */
  tap?: (x: number, y: number, e: PointerEvent) => void;
  /** Touch only: the finger moved before the hold finished, sideways (for swiping between days). */
  swipe?: (dx: number, dy: number, phase: "move" | "end" | "cancel", e?: PointerEvent) => boolean | void;
};

export type GestureOptions = {
  /** Mouse: pixels to move before a drag starts. */
  threshold?: number;
  /** Touch and pen: how long to hold before a drag starts (0: drag at once, for handles). */
  hold?: number;
  /** Touch: how far the finger may wander while holding. */
  slop?: number;
};

let blockScroll = false;
let blockerInstalled = false;

function installBlocker() {
  if (blockerInstalled || typeof window === "undefined") return;
  blockerInstalled = true;
  window.addEventListener(
    "touchmove",
    (e) => {
      if (blockScroll && e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
}

/** Ignores the click a browser sends right after a touch tap (for a moment only). */
function swallowClick() {
  const stop = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener("click", stop, true);
  };
  window.addEventListener("click", stop, true);
  setTimeout(() => window.removeEventListener("click", stop, true), 450);
}

/** A short buzz where the device has one (Android; iOS ignores it). */
export function buzz(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not allowed here.
  }
}

/** Starts following a pointer that went down. Returns a function that cancels it. */
export function track(down: PointerEvent | React.PointerEvent, h: GestureHandlers, opts: GestureOptions = {}): () => void {
  installBlocker();
  const id = down.pointerId;
  const touch = down.pointerType !== "mouse";
  const threshold = opts.threshold ?? 4;
  const hold = opts.hold ?? 360;
  const slop = opts.slop ?? 9;
  const x0 = down.clientX;
  const y0 = down.clientY;
  let x = x0;
  let y = y0;
  let active = false;
  let done = false;
  let swiping = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const begin = () => {
    if (done || active) return;
    if (h.start(x, y) === false) {
      finish();
      return;
    }
    active = true;
    if (touch) {
      blockScroll = true;
      buzz();
    }
    document.documentElement.dataset.dragging = "";
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    x = e.clientX;
    y = e.clientY;
    const dx = x - x0;
    const dy = y - y0;
    if (active) {
      h.move(x, y, e);
      return;
    }
    if (swiping) {
      h.swipe?.(dx, dy, "move", e);
      return;
    }
    if (!touch) {
      if (Math.hypot(dx, dy) > threshold) {
        begin();
        if (active) h.move(x, y, e);
      }
      return;
    }
    if (Math.hypot(dx, dy) > slop) {
      // Moving before the hold: scrolling, or swiping sideways between days.
      if (timer) clearTimeout(timer);
      timer = null;
      if (h.swipe && Math.abs(dx) > Math.abs(dy) * 1.2 && h.swipe(dx, dy, "move", e) !== false) swiping = true;
      else finish();
    }
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    x = e.clientX;
    y = e.clientY;
    if (active) h.end(x, y, e);
    else if (swiping) h.swipe?.(x - x0, y - y0, "end", e);
    else if (Math.hypot(x - x0, y - y0) <= (touch ? slop : threshold)) {
      // The browser follows a tap with a click; it would land on whatever the tap just opened
      // (a sheet's backdrop) and close it again.
      if (touch) swallowClick();
      h.tap?.(x, y, e);
    }
    finish();
  };

  const onCancel = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    if (active) h.cancel();
    else if (swiping) h.swipe?.(0, 0, "cancel");
    finish();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !active) return;
    e.preventDefault();
    e.stopPropagation();
    h.cancel();
    finish();
  };

  // A long press on touch screens would open the system menu or select text.
  const onContext = (e: Event) => {
    if (touch) e.preventDefault();
  };

  function finish() {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
    blockScroll = false;
    delete document.documentElement.dataset.dragging;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("contextmenu", onContext, true);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("contextmenu", onContext, true);
  if (touch) {
    if (hold <= 0) begin();
    else timer = setTimeout(begin, hold);
  }

  return () => {
    if (active) h.cancel();
    finish();
  };
}

/**
 * Scrolls `el` while the pointer is near its top or bottom edge (dragging past what is visible),
 * calling `after` once per frame it scrolled so the drag can follow.
 */
export function edgeScroller(el: HTMLElement, after: () => void, opts: { edge?: number; top?: number } = {}) {
  const edge = opts.edge ?? 48;
  let y = -1;
  let frame = 0;
  const loop = () => {
    frame = 0;
    if (y < 0) return;
    const r = el.getBoundingClientRect();
    const top = r.top + (opts.top ?? 0);
    let speed = 0;
    if (y < top + edge) speed = -Math.ceil(((top + edge - y) / edge) * 14);
    else if (y > r.bottom - edge) speed = Math.ceil(((y - (r.bottom - edge)) / edge) * 14);
    if (speed) {
      const before = el.scrollTop;
      el.scrollTop += Math.max(-24, Math.min(24, speed));
      if (el.scrollTop !== before) after();
      frame = requestAnimationFrame(loop);
    }
  };
  return {
    update(pointerY: number) {
      y = pointerY;
      if (!frame) frame = requestAnimationFrame(loop);
    },
    stop() {
      y = -1;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
