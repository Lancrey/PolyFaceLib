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
      const code = e.keyCode || e.key.charCodeAt(0);
      const digit = parseInt(e.key, 10);
      if (!Number.isNaN(digit) && digit >= 1 && digit <= n) {
        handlers.onEdge(digit - 1);
        e.preventDefault();
      }
      void code;
      return;
    }
    if (mode === 'tab') {
      const n = getEdgeCount();
      if (e.key === 'Tab') {
        const dir = e.shiftKey ? -1 : 1;
        // The host caller manages focused-edge state externally; emit edge events.
        // For simplicity, advance by 1 from edge 0.
        handlers.onEdge(((dir + n) % n) + 0);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        handlers.onEdge(0);
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
