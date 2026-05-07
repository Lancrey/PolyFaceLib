import type { PolyFaceLib } from '../public-api';

export type SyncMode = 'parallel' | 'mirror' | 'opposite' | 'custom';

export interface SyncOptions {
  mode: SyncMode;
  /** If set, only this view emits; others are passive listeners. Default: bidirectional. */
  master?: PolyFaceLib;
  /** Sync per-face scroll position. Default false. */
  syncScroll?: boolean;
  /** Animate together vs sequentially. Default true. */
  syncAnimation?: boolean;
  /**
   * Custom mapping: required when `mode === 'custom'`. Receives the source view,
   * the navigation event payload, and the list of target views to update.
   */
  map?: (event: SyncEvent, source: PolyFaceLib, targets: readonly PolyFaceLib[]) => void;
  /** When mirror, axis around which the navigation flips. */
  axis?: 'horizontal' | 'vertical';
}

export interface SyncEvent {
  type: 'navigate' | 'scroll';
  edgeIndex?: number;
  faceIndex?: number;
  scrollX?: number;
  scrollY?: number;
}

export interface SyncLink {
  pause(): void;
  resume(): void;
  unsync(): void;
}

const FORWARD_TAG = Symbol('pf:syncForward');

interface TaggedView {
  [FORWARD_TAG]?: boolean;
}

/**
 * Link multiple views to propagate navigation (and optionally scroll) events.
 * Returns a SyncLink with pause/resume/unsync controls.
 */
export function sync(views: readonly PolyFaceLib[], options: SyncOptions): SyncLink {
  if (views.length < 2) throw new Error('sync(): at least two views required.');

  if (options.mode === 'custom' && typeof options.map !== 'function') {
    throw new Error("sync(): 'custom' mode requires a `map` callback.");
  }

  // Validate topology compatibility for non-custom modes.
  if (options.mode === 'parallel' || options.mode === 'mirror' || options.mode === 'opposite') {
    const firstFaceCount = views[0]!.getFaceCount();
    for (const v of views) {
      if (v.getFaceCount() !== firstFaceCount) {
        throw new Error(`sync(): mode '${options.mode}' requires polyhedra of identical topology.`);
      }
    }
  }

  let paused = false;
  const disposers: Array<() => void> = [];

  const propagateNavigate = (source: PolyFaceLib, edgeIndex: number) => {
    if (paused) return;
    if ((source as unknown as TaggedView)[FORWARD_TAG]) return;
    const targets = views.filter(v => v !== source);
    if (options.mode === 'custom' && options.map) {
      const ev: SyncEvent = { type: 'navigate', edgeIndex };
      options.map(ev, source, targets);
      return;
    }
    for (const t of targets) {
      let mapped = edgeIndex;
      if (options.mode === 'mirror') {
        const axis = options.axis ?? 'horizontal';
        // Mirror by flipping edge index around the centroid of the face.
        const n = t.getCurrentFace().rollSteps;
        if (axis === 'horizontal') mapped = (n - edgeIndex) % n;
        else mapped = (n - edgeIndex + Math.floor(n / 2)) % n;
      } else if (options.mode === 'opposite') {
        const n = t.getCurrentFace().rollSteps;
        mapped = (edgeIndex + Math.floor(n / 2)) % n;
      }
      // 'parallel' uses edgeIndex as-is.
      (t as unknown as TaggedView)[FORWARD_TAG] = true;
      void t.navigateEdge(mapped).finally(() => {
        delete (t as unknown as TaggedView)[FORWARD_TAG];
      });
    }
  };

  const propagateScroll = (source: PolyFaceLib, faceIndex: number, x: number, y: number) => {
    if (paused) return;
    if (!options.syncScroll) return;
    if ((source as unknown as TaggedView)[FORWARD_TAG]) return;
    const targets = views.filter(v => v !== source);
    for (const t of targets) {
      (t as unknown as TaggedView)[FORWARD_TAG] = true;
      try {
        t.scrollFace(faceIndex, x, y);
      } finally {
        delete (t as unknown as TaggedView)[FORWARD_TAG];
      }
    }
  };

  const candidateSources = options.master ? [options.master] : views;

  for (const v of candidateSources) {
    const offNav = v.on('beforeNavigate', (e) => {
      if (e.edgeIndex !== undefined) propagateNavigate(v, e.edgeIndex);
    });
    const offScroll = v.on('faceScroll', (e) => {
      propagateScroll(v, e.face, e.x, e.y);
    });
    disposers.push(offNav, offScroll);
  }

  return {
    pause() { paused = true; },
    resume() { paused = false; },
    unsync() {
      paused = true;
      for (const d of disposers) d();
      disposers.length = 0;
    },
  };
}
