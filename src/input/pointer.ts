import type { FaceZones } from './zones';
import { hitTestZones } from './zones';

export interface PointerHandlers {
  onEdgeClick: (visibleEdgeIndex: number) => void;
  onSwipe: (visibleEdgeIndex: number, vector: { dx: number; dy: number }) => void;
  onFaceClick: (position: { x: number; y: number }) => void;
}

export interface PointerOptions {
  /** Pixel threshold to count a pointermove as a swipe rather than a tap. Default 30. */
  swipeThreshold?: number;
  /** If true, intercept pointers anywhere; else only outside the dead zone. */
  swipeMode?: 'edge' | 'twoFingers' | 'always';
  /** Whether edge clicks are enabled. Default true. */
  edgeClick?: boolean;
  /** Whether swipes are enabled. Default true. */
  swipe?: boolean;
}

interface PointerState {
  pointerId: number;
  startX: number;
  startY: number;
  startEdge: number; // edge zone we started in, or -1
  fingers: number;
}

/**
 * Wire pointer interactions on the *active face* element. Coordinates passed
 * to handlers are in face-local space (centered, Y-down).
 *
 * The faceZones object passed in is read at every event — caller can rotate
 * it as the face's roll changes.
 */
export function attachPointerListeners(
  faceEl: HTMLElement,
  getZones: () => FaceZones,
  handlers: PointerHandlers,
  opts: PointerOptions = {},
): () => void {
  const swipeThreshold = opts.swipeThreshold ?? 30;
  const swipeMode = opts.swipeMode ?? 'edge';
  const edgeClick = opts.edgeClick !== false;
  const swipe = opts.swipe !== false;

  const active = new Map<number, PointerState>();
  let multiTouchCount = 0;

  function localCoords(e: PointerEvent): { x: number; y: number } {
    const r = faceEl.getBoundingClientRect();
    const lx = e.clientX - r.left - r.width / 2;
    const ly = e.clientY - r.top - r.height / 2;
    return { x: lx, y: ly };
  }

  function onPointerDown(e: PointerEvent) {
    const zones = getZones();
    const { x, y } = localCoords(e);
    const edge = hitTestZones(zones, x, y);

    multiTouchCount++;
    active.set(e.pointerId, {
      pointerId: e.pointerId,
      startX: x,
      startY: y,
      startEdge: edge,
      fingers: multiTouchCount,
    });
    // We do NOT capture the pointer — that would block native scroll inside the dead zone.
  }

  function onPointerMove(e: PointerEvent) {
    if (!swipe) return;
    const state = active.get(e.pointerId);
    if (!state) return;
    const { x, y } = localCoords(e);
    const dx = x - state.startX;
    const dy = y - state.startY;
    if (Math.hypot(dx, dy) < swipeThreshold) return;

    // Determine if we should treat this as a navigation swipe.
    const allow =
      (swipeMode === 'always') ||
      (swipeMode === 'edge' && state.startEdge >= 0) ||
      (swipeMode === 'twoFingers' && multiTouchCount >= 2);

    if (!allow) {
      active.delete(e.pointerId);
      return;
    }

    // Determine which visible edge this swipe targets.
    const zones = getZones();
    // Direction = atan2(-dy, dx) in screen space → but our zones use Y-down so use (dy, dx) in CSS coords.
    const angle = Math.atan2(dy, dx);
    // Pick the edge zone whose midpoint direction (from centroid) is closest to the swipe direction.
    let bestIdx = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < zones.edgeZones.length; i++) {
      const tri = zones.edgeZones[i]!;
      const a = tri[1]!;
      const b = tri[2]!;
      const mx = (a[0] + b[0]) / 2 - zones.center[0];
      const my = (a[1] + b[1]) / 2 - zones.center[1];
      const ma = Math.atan2(my, mx);
      let d = Math.abs(ma - angle) % (2 * Math.PI);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d < bestDelta) {
        bestDelta = d;
        bestIdx = i;
      }
    }
    handlers.onSwipe(bestIdx, { dx, dy });
    active.delete(e.pointerId);
  }

  function onPointerUp(e: PointerEvent) {
    const state = active.get(e.pointerId);
    multiTouchCount = Math.max(0, multiTouchCount - 1);
    active.delete(e.pointerId);
    if (!state) return;

    const { x, y } = localCoords(e);
    const dx = x - state.startX;
    const dy = y - state.startY;
    const moved = Math.hypot(dx, dy);
    if (moved >= swipeThreshold) return; // already handled by move
    if (state.startEdge >= 0 && edgeClick) {
      handlers.onEdgeClick(state.startEdge);
    } else {
      handlers.onFaceClick({ x, y });
    }
  }

  function onPointerCancel(e: PointerEvent) {
    multiTouchCount = Math.max(0, multiTouchCount - 1);
    active.delete(e.pointerId);
  }

  faceEl.addEventListener('pointerdown', onPointerDown);
  faceEl.addEventListener('pointermove', onPointerMove);
  faceEl.addEventListener('pointerup', onPointerUp);
  faceEl.addEventListener('pointercancel', onPointerCancel);

  return () => {
    faceEl.removeEventListener('pointerdown', onPointerDown);
    faceEl.removeEventListener('pointermove', onPointerMove);
    faceEl.removeEventListener('pointerup', onPointerUp);
    faceEl.removeEventListener('pointercancel', onPointerCancel);
  };
}
