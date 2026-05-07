export type KeyboardMode = 'arrows' | 'numeric' | 'tab';

export interface KeyboardConfig {
  enabled?: boolean;
  mode?: KeyboardMode;
}

export interface KeyboardHandlers {
  /** User picked a visible-edge index (0..N-1) for the active face. */
  onEdge: (edgeIndex: number) => void;
  /** Direction-style navigation. */
  onDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export function attachKeyboardListeners(
  el: HTMLElement,
  getEdgeCount: () => number,
  handlers: KeyboardHandlers,
  config: KeyboardConfig = {},
): () => void {
  if (config.enabled === false) return () => {};
  const mode: KeyboardMode = config.mode ?? 'arrows';
  let tabCursor = 0;

  function onKey(e: KeyboardEvent) {
    if (mode === 'arrows') {
      switch (e.key) {
        case 'ArrowUp': handlers.onDirection('up'); e.preventDefault(); break;
        case 'ArrowDown': handlers.onDirection('down'); e.preventDefault(); break;
        case 'ArrowLeft': handlers.onDirection('left'); e.preventDefault(); break;
        case 'ArrowRight': handlers.onDirection('right'); e.preventDefault(); break;
        default: break;
      }
      return;
    }
    if (mode === 'numeric') {
      const n = getEdgeCount();
      const digit = parseInt(e.key, 10);
      if (!Number.isNaN(digit) && digit >= 1 && digit <= n) {
        handlers.onEdge(digit - 1);
        e.preventDefault();
      }
      return;
    }
    if (mode === 'tab') {
      const n = getEdgeCount();
      if (e.key === 'Tab') {
        // Cycle through the visible edges. Host manages the focused-edge cursor
        // externally if it needs richer tab semantics — the harness here just
        // advances forward (or backward with Shift) and confirms via Enter.
        tabCursor = (tabCursor + (e.shiftKey ? -1 : 1) + n) % n;
        e.preventDefault();
      } else if (e.key === 'Enter') {
        handlers.onEdge(((tabCursor % n) + n) % n);
        e.preventDefault();
      }
    }
  }

  el.addEventListener('keydown', onKey);
  return () => el.removeEventListener('keydown', onKey);
}

/**
 * Pick the visible edge whose midpoint direction best matches the given
 * cardinal direction. Used by the 'arrows' keyboard mode and by the
 * `view.navigate('right')` sugar.
 */
export function edgeForDirection(
  midpointAngles: readonly number[],
  dir: 'up' | 'down' | 'left' | 'right',
): number {
  // CSS angles: 0 = +X (right), π/2 = +Y (down), -π/2 = up, π = left.
  const target =
    dir === 'right' ? 0 :
    dir === 'left' ? Math.PI :
    dir === 'up' ? -Math.PI / 2 :
    Math.PI / 2;
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < midpointAngles.length; i++) {
    let d = Math.abs(midpointAngles[i]! - target) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d < bestDelta) {
      bestDelta = d;
      best = i;
    }
  }
  return best;
}
