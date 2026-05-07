import { Quat } from './core/math/quat';
import type { Quat as QuatT } from './core/math/quat';
import { Easing, startQuatAnimation, stepQuatAnimation, animationProgress } from './core/animator';
import type { EasingFn, QuatAnimationState } from './core/animator';
import { FrameLoop } from './core/frame';
import { Projector } from './core/projector';
import type { FaceModel } from './core/projector';
import type { Polyhedron } from './polyhedra/polyhedron';
import { validatePolyhedron } from './polyhedra/polyhedron';
import { canonicalOrientation } from './polyhedra/orientations';
import type { CanonicalOrientation } from './polyhedra/orientations';
import { buildAdjacency } from './polyhedra/adjacency';
import type { FaceAdjacency } from './polyhedra/adjacency';
import { buildTransitionTable, visibleEdgeAngles } from './polyhedra/transitions';
import type { TransitionTable } from './polyhedra/transitions';
import { buildStage, applyStage, destroyStage } from './render/stage';
import type { StageElements } from './render/stage';
import { computeSize, classify, DEFAULT_BREAKPOINTS, StageResizeObserver } from './render/responsive';
import type { BreakpointsConfig, SizingMode, Breakpoint } from './render/responsive';
import { applyTransparency } from './transparency/depth-opacity';
import type { TransparencyConfig } from './transparency/depth-opacity';
import { buildFaceZones } from './input/zones';
import type { FaceZones } from './input/zones';
import { attachPointerListeners } from './input/pointer';
import type { PointerOptions } from './input/pointer';
import { attachKeyboardListeners, edgeForDirection } from './input/keyboard';
import type { KeyboardConfig } from './input/keyboard';
import { buildControls } from './input/controls';
import type { ControlsMode } from './input/controls';
import { applyFaceContent } from './faces/face-content';
import type { FaceContent } from './faces/face-content';
import { Emitter } from './events';
import type { EventMap, EventName, Listener } from './events';
import { PersistenceManager } from './persistence/persistence';
import type { PersistenceConfig, PersistedState } from './persistence/persistence';

export interface InteractionConfig {
  edgeClick?: boolean;
  swipe?: boolean;
  swipeMode?: PointerOptions['swipeMode'];
  controls?: ControlsMode;
  keyboard?: KeyboardConfig;
}

export interface AnimationConfig {
  duration?: number;
  easing?: EasingFn;
}

export interface PolyFaceLibOptions {
  container: HTMLElement | string;
  polyhedron: Polyhedron;
  size?: SizingMode;
  initialFace?: number;
  transparency?: TransparencyConfig | false;
  animation?: AnimationConfig;
  /** Distance focale. Defaults to 800. */
  perspective?: number;
  background?: string | null;
  interaction?: InteractionConfig;
  breakpoints?: BreakpointsConfig;
  resetScrollOnNavigate?: boolean;
  prefersReducedMotion?: 'auto' | boolean;
  /** Center dead zone as a fraction (0..1) of the inradius. Default 0.6. */
  centerDeadZone?: number;
  /** Pixel threshold for swipe detection. Default 30. */
  swipeThreshold?: number;
  /** Apply automatic safe-area padding on non-rectangular faces. Default true. */
  safeAreaPadding?: boolean;
  /** Validation strictness for the polyhedron. Default false. */
  strictValidation?: boolean;
  /** Persistence configuration. Default disabled. */
  persistence?: PersistenceConfig;
  /** Whether to queue navigation requests received during an animation. Default false. */
  queueInputs?: boolean;
}

export interface CurrentFace {
  index: number;
  roll: number;
  rollSteps: number;
}

const DEFAULT_DURATION = 400;

export class PolyFaceLib {
  // Core
  private polyhedron: Polyhedron;
  private container: HTMLElement;
  private elements: StageElements;
  private emitter = new Emitter();
  private projector: Projector;
  private adjacency: readonly FaceAdjacency[];
  private orientations: readonly CanonicalOrientation[];
  private transitions: TransitionTable;

  // State
  private currentFace = 0;
  private currentRoll = 0;
  private currentRotation: QuatT;
  private animation: QuatAnimationState | null = null;
  private size = 0;
  private containerWidth = 0;
  private containerHeight = 0;
  private breakpoint: Breakpoint = 'desktop';
  private destroyed = false;
  private started = false;
  private faceContentDisposers: Array<(() => void) | null>;
  private faceScrollState = new Map<number, [number, number]>();
  private scrollListeners: Array<() => void> = [];
  private pendingNav: number | null = null;
  private announcedFace = -1;

  // Input cleanup
  private pointerCleanup: (() => void) | null = null;
  private keyboardCleanup: (() => void) | null = null;
  private controlsCleanup: (() => void) | null = null;

  // Resize observer
  private resizeObs: StageResizeObserver | null = null;

  // Frame loop
  private loop: FrameLoop;

  // Options
  private opts: Required<Omit<PolyFaceLibOptions, 'persistence' | 'transparency' | 'animation' | 'interaction' | 'container' | 'polyhedron'>> & {
    transparency: TransparencyConfig | false;
    animation: AnimationConfig;
    interaction: InteractionConfig;
    persistence?: PersistenceConfig;
  };

  // Persistence
  private persistence: PersistenceManager | null = null;
  ready: Promise<void>;

  constructor(options: PolyFaceLibOptions) {
    const container = typeof options.container === 'string'
      ? document.querySelector<HTMLElement>(options.container)
      : options.container;
    if (!container) throw new Error(`PolyFaceLib: container not found.`);
    this.container = container;
    this.polyhedron = options.polyhedron;

    const validation = validatePolyhedron(this.polyhedron, { strictConvex: options.strictValidation });
    if (!validation.ok) {
      throw new Error(`PolyFaceLib: invalid polyhedron — ${validation.errors.join('; ')}`);
    }
    if (validation.warnings.length > 0) {
      console.warn('[polyfacelib] polyhedron warnings:', validation.warnings);
    }

    this.adjacency = buildAdjacency(this.polyhedron);
    this.orientations = this.polyhedron.faces.map((_, i) => canonicalOrientation(this.polyhedron, i));
    this.transitions = buildTransitionTable(this.polyhedron);

    // Defaults
    this.opts = {
      size: options.size ?? 'fit',
      initialFace: options.initialFace ?? 0,
      transparency: options.transparency ?? false,
      animation: options.animation ?? {},
      perspective: options.perspective ?? 800,
      background: options.background ?? null,
      interaction: options.interaction ?? {},
      breakpoints: options.breakpoints ?? DEFAULT_BREAKPOINTS,
      resetScrollOnNavigate: options.resetScrollOnNavigate ?? false,
      prefersReducedMotion: options.prefersReducedMotion ?? 'auto',
      centerDeadZone: options.centerDeadZone ?? 0.6,
      swipeThreshold: options.swipeThreshold ?? 30,
      safeAreaPadding: options.safeAreaPadding ?? true,
      strictValidation: options.strictValidation ?? false,
      queueInputs: options.queueInputs ?? false,
      persistence: options.persistence,
    };

    this.currentFace = this.opts.initialFace;
    this.currentRoll = 0;
    this.currentRotation = this.transitions.orientationOf(this.currentFace, this.currentRoll);

    this.faceContentDisposers = new Array(this.polyhedron.faces.length).fill(null);

    // Build DOM
    this.elements = buildStage(this.container, {
      faceCount: this.polyhedron.faces.length,
      background: this.opts.background,
      safeAreaPadding: this.opts.safeAreaPadding,
    });

    // Initial size
    const r = this.container.getBoundingClientRect();
    this.containerWidth = r.width || 400;
    this.containerHeight = r.height || 400;
    this.size = computeSize(this.containerWidth, this.containerHeight, this.opts.size);
    this.breakpoint = classify(this.containerWidth, this.opts.breakpoints);
    this.projector = new Projector(this.polyhedron, { size: this.size, perspective: this.opts.perspective });

    // Resize observer
    this.resizeObs = new StageResizeObserver(this.container, (w, h) => this.handleResize(w, h));

    // Frame loop
    this.loop = new FrameLoop({ alwaysRun: false });
    this.loop.setCallback((now) => this.tick(now));

    // Persistence
    let restored: Promise<void> = Promise.resolve();
    if (this.opts.persistence?.enabled) {
      this.persistence = new PersistenceManager(this.opts.persistence);
      restored = this.persistence.load().then((state) => {
        if (!state) return;
        this.applyPersistedState(state);
      });
    }
    this.ready = restored;

    // Wire scroll listeners
    this.elements.viewports.forEach((vp, i) => {
      const handler = () => {
        const x = vp.scrollLeft;
        const y = vp.scrollTop;
        this.faceScrollState.set(i, [x, y]);
        this.emitter.emit('faceScroll', { face: i, x, y });
        this.schedulePersist();
      };
      vp.addEventListener('scroll', handler, { passive: true });
      this.scrollListeners.push(() => vp.removeEventListener('scroll', handler));
    });

    // Initial render
    this.render(performance.now());
    this.refreshControlsAndInputs();
  }

  private applyPersistedState(state: PersistedState): void {
    if (state.face !== undefined && state.face >= 0 && state.face < this.polyhedron.faces.length) {
      this.currentFace = state.face;
      const N = this.orientations[this.currentFace]!.rollSteps;
      this.currentRoll = ((state.roll ?? 0) % N + N) % N;
      this.currentRotation = this.transitions.orientationOf(this.currentFace, this.currentRoll);
    }
    if (state.scroll) {
      for (const [k, v] of Object.entries(state.scroll)) {
        const idx = Number(k);
        if (Number.isFinite(idx) && idx >= 0 && idx < this.polyhedron.faces.length) {
          this.faceScrollState.set(idx, v as [number, number]);
          const vp = this.elements.viewports[idx];
          if (vp) {
            vp.scrollLeft = v[0] ?? 0;
            vp.scrollTop = v[1] ?? 0;
          }
        }
      }
    }
    if (state.rotation) {
      this.currentRotation = state.rotation as QuatT;
    }
    this.render(performance.now());
  }

  // ---- Lifecycle ----

  start(): void {
    if (this.destroyed || this.started) return;
    this.started = true;
    this.resizeObs?.start();
    this.loop.start();
    this.refreshControlsAndInputs();
    this.render(performance.now());
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.loop.stop();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    this.resizeObs?.stop();
    this.pointerCleanup?.();
    this.keyboardCleanup?.();
    this.controlsCleanup?.();
    for (const off of this.scrollListeners) off();
    this.scrollListeners.length = 0;
    for (const d of this.faceContentDisposers) d?.();
    this.persistence?.flush().finally(() => this.persistence?.destroy());
    this.emitter.clear();
    destroyStage(this.elements);
  }

  resize(): void {
    const r = this.container.getBoundingClientRect();
    this.handleResize(r.width, r.height);
  }

  private handleResize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.containerWidth = width;
    this.containerHeight = height;
    const newSize = computeSize(width, height, this.opts.size);
    if (Math.abs(newSize - this.size) > 0.5) {
      this.size = newSize;
      this.projector = new Projector(this.polyhedron, { size: this.size, perspective: this.opts.perspective });
    }
    const newBp = classify(width, this.opts.breakpoints);
    if (newBp !== this.breakpoint) {
      this.breakpoint = newBp;
    }
    this.emitter.emit('resize', { width, height, size: this.size });
    this.refreshControlsAndInputs();
    this.render(performance.now());
  }

  // ---- Face content ----

  setFace(index: number, content: FaceContent): void {
    if (index < 0 || index >= this.polyhedron.faces.length) {
      throw new Error(`setFace: index ${index} out of range.`);
    }
    const prev = this.faceContentDisposers[index];
    if (prev) prev();
    const contentEl = this.elements.contents[index]!;
    this.faceContentDisposers[index] = applyFaceContent(contentEl, content);
  }

  // ---- Navigation ----

  navigateEdge(edgeIndex: number): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    if (this.animation && !this.animation.done) {
      if (this.opts.queueInputs) {
        this.pendingNav = edgeIndex;
      }
      return Promise.resolve();
    }
    const t = this.transitions.get(this.currentFace, this.currentRoll, edgeIndex);
    let prevented = false;
    this.emitter.emit('beforeNavigate', {
      from: this.currentFace,
      to: t.toFace,
      edgeIndex,
      preventDefault: () => { prevented = true; },
    });
    if (prevented) return Promise.resolve();
    return this.animateTo(t.toFace, t.toRoll, t.targetRotation, edgeIndex);
  }

  navigateDirection(angleRadians: number): Promise<void> {
    const angles = visibleEdgeAngles(this.polyhedron, this.currentFace, this.currentRoll, this.adjacency);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < angles.length; i++) {
      let d = Math.abs(angles[i]! - angleRadians) % (2 * Math.PI);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return this.navigateEdge(best);
  }

  navigate(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    const angles = visibleEdgeAngles(this.polyhedron, this.currentFace, this.currentRoll, this.adjacency);
    const idx = edgeForDirection(angles, direction);
    return this.navigateEdge(idx);
  }

  goToFace(index: number, opts: { animate?: boolean } = {}): Promise<void> {
    if (index < 0 || index >= this.polyhedron.faces.length) {
      return Promise.reject(new Error(`goToFace: index ${index} out of range.`));
    }
    const animate = opts.animate !== false;
    const target = this.transitions.orientationOf(index, 0);
    let prevented = false;
    this.emitter.emit('beforeNavigate', {
      from: this.currentFace,
      to: index,
      preventDefault: () => { prevented = true; },
    });
    if (prevented) return Promise.resolve();
    if (!animate) {
      const fromFace = this.currentFace;
      this.currentRotation = target;
      this.currentFace = index;
      this.currentRoll = 0;
      this.animation = null;
      this.emitter.emit('afterNavigate', { from: fromFace, to: index });
      this.render(performance.now());
      this.refreshControlsAndInputs();
      this.schedulePersist();
      return Promise.resolve();
    }
    return this.animateTo(index, 0, target);
  }

  getCurrentFace(): CurrentFace {
    return {
      index: this.currentFace,
      roll: this.currentRoll,
      rollSteps: this.orientations[this.currentFace]!.rollSteps,
    };
  }

  getFaceCount(): number {
    return this.polyhedron.faces.length;
  }

  // ---- Scroll ----

  scrollFace(face: number, x: number, y: number): void {
    const vp = this.elements.viewports[face];
    if (!vp) return;
    vp.scrollLeft = x;
    vp.scrollTop = y;
    this.faceScrollState.set(face, [x, y]);
  }

  getFaceScroll(face: number): { x: number; y: number } {
    const tuple = this.faceScrollState.get(face);
    if (tuple) return { x: tuple[0]!, y: tuple[1]! };
    const vp = this.elements.viewports[face];
    if (!vp) return { x: 0, y: 0 };
    return { x: vp.scrollLeft, y: vp.scrollTop };
  }

  // ---- Persistence ----

  async persist(): Promise<void> {
    if (!this.persistence) return;
    this.persistence.scheduleWrite(this.snapshotState());
    await this.persistence.flush();
  }

  async restore(): Promise<void> {
    if (!this.persistence) return;
    const state = await this.persistence.load();
    if (state) this.applyPersistedState(state);
  }

  async clearPersisted(): Promise<void> {
    if (!this.persistence) return;
    await this.persistence.clear();
  }

  private snapshotState(): PersistedState {
    const scroll: Record<number, [number, number]> = {};
    for (const [k, v] of this.faceScrollState) scroll[k] = v;
    return {
      v: this.opts.persistence?.schemaVersion ?? 1,
      face: this.currentFace,
      roll: this.currentRoll,
      scroll,
      rotation: [this.currentRotation[0], this.currentRotation[1], this.currentRotation[2], this.currentRotation[3]],
      ts: Date.now(),
    };
  }

  private schedulePersist(): void {
    if (!this.persistence) return;
    this.persistence.scheduleWrite(this.snapshotState());
  }

  // ---- Events ----

  on<E extends EventName>(name: E, fn: Listener<E>): () => void {
    return this.emitter.on(name, fn);
  }
  off<E extends EventName>(name: E, fn: Listener<E>): void {
    this.emitter.off(name, fn);
  }

  // ---- Internals ----

  private animateTo(face: number, roll: number, target: QuatT, edgeIndex?: number): Promise<void> {
    return new Promise((resolve) => {
      const reduced = this.shouldReduceMotion();
      const duration = reduced ? 0 : (this.opts.animation.duration ?? DEFAULT_DURATION);
      const easing = this.opts.animation.easing ?? Easing.easeInOutCubic;

      this.elements.root.setAttribute('data-pf-animating', 'true');
      this.animation = startQuatAnimation(this.currentRotation, target, { duration, easing });
      const fromFace = this.currentFace;
      this.currentFace = face;
      this.currentRoll = roll;
      this.refreshControlsAndInputs();

      const finish = () => {
        this.currentRotation = target;
        this.animation = null;
        this.elements.root.removeAttribute('data-pf-animating');
        this.emitter.emit('afterNavigate', { from: fromFace, to: face });
        if (this.opts.resetScrollOnNavigate) {
          const vp = this.elements.viewports[face];
          if (vp) {
            vp.scrollLeft = 0;
            vp.scrollTop = 0;
            this.faceScrollState.set(face, [0, 0]);
          }
        }
        this.schedulePersist();
        // Drain pending input
        if (this.pendingNav !== null) {
          const next = this.pendingNav;
          this.pendingNav = null;
          this.navigateEdge(next).then(resolve).catch(() => resolve());
          return;
        }
        resolve();
      };

      if (duration === 0) {
        finish();
        return;
      }
      const offFrame = this.emitter.on('animationFrame', (e) => {
        if (e.progress >= 1) {
          offFrame();
          finish();
        }
      });
      // Make sure the loop runs on demand.
      this.loop.start();
      this.loop.wake();
      void edgeIndex;
    });
  }

  private shouldReduceMotion(): boolean {
    if (this.opts.prefersReducedMotion === true) return true;
    if (this.opts.prefersReducedMotion === false) return false;
    if (typeof matchMedia === 'function') {
      try {
        return matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        return false;
      }
    }
    return false;
  }

  private tick(now: number): void {
    if (this.animation) {
      const q = stepQuatAnimation(this.animation, now);
      this.currentRotation = q;
      this.render(now);
      const p = animationProgress(this.animation, now);
      this.emitter.emit('animationFrame', { progress: p });
      if (!this.animation.done) {
        this.loop.wake();
      }
    } else {
      this.render(now);
    }
  }

  private render(_now: number): void {
    const frames = this.projector.computeFrame({ rotation: this.currentRotation });
    const t = this.opts.transparency;
    if (t && typeof t === 'object' && t.enabled) {
      applyTransparency(frames, t);
    } else {
      // Default: full opacity for all visible faces; back faces hidden via pointer-events.
      for (const f of frames) f.opacity = 1;
    }
    applyStage(this.elements, {
      models: this.projector.faceModels,
      frames,
      activeFace: this.currentFace,
      safeAreaPadding: this.opts.safeAreaPadding,
    });

    // CSS variables on root for user styling hooks.
    this.elements.root.style.setProperty('--pf-current-face', String(this.currentFace));
    this.elements.root.style.setProperty('--pf-face-sides', String(this.orientations[this.currentFace]!.rollSteps));
    this.elements.root.style.setProperty('--pf-face-size', `${this.size}px`);

    // Live region: only announce when the active face actually changes,
    // otherwise screen readers see a new message every animation frame.
    if (this.announcedFace !== this.currentFace) {
      this.announcedFace = this.currentFace;
      this.elements.liveRegion.textContent = `Face ${this.currentFace + 1} of ${this.polyhedron.faces.length}`;
    }
  }

  private getActiveZones(): FaceZones {
    const model = this.projector.faceModels[this.currentFace]!;
    const zones = buildFaceZones(model, this.opts.centerDeadZone);
    return zones;
  }

  private getActiveFaceRect(): { left: number; top: number; width: number; height: number } {
    // Project face center (model translation) through camera to find screen center.
    // Simpler: use the face element's bounding rect relative to controlsRoot.
    const faceEl = this.elements.faces[this.currentFace]!;
    const rootRect = this.elements.controlsRoot.getBoundingClientRect();
    const r = faceEl.getBoundingClientRect();
    return { left: r.left - rootRect.left, top: r.top - rootRect.top, width: r.width, height: r.height };
  }

  private refreshControlsAndInputs(): void {
    // Cleanup previous
    this.pointerCleanup?.();
    this.controlsCleanup?.();
    this.keyboardCleanup?.();

    const interaction = this.opts.interaction;

    // Defaults per breakpoint
    const controlsMode: ControlsMode = interaction.controls
      ?? (this.breakpoint === 'desktop' ? 'none' : 'edges');
    const keyboardConfig: KeyboardConfig = interaction.keyboard ?? { enabled: this.breakpoint === 'desktop', mode: 'arrows' };

    // Build controls
    this.controlsCleanup = buildControls(
      this.elements.controlsRoot,
      () => this.getActiveZones(),
      () => this.getActiveFaceRect(),
      controlsMode,
      { onEdgeClick: (i) => { void this.navigateEdge(i); } },
    );

    // Pointer
    const activeFaceEl = this.elements.faces[this.currentFace]!;
    this.pointerCleanup = attachPointerListeners(
      activeFaceEl,
      () => this.getActiveZones(),
      {
        onEdgeClick: (i) => { void this.navigateEdge(i); },
        onSwipe: (i) => { void this.navigateEdge(i); },
        onFaceClick: (pos) => this.emitter.emit('faceClick', { face: this.currentFace, position: pos }),
      },
      {
        edgeClick: interaction.edgeClick !== false,
        swipe: interaction.swipe !== false,
        swipeMode: interaction.swipeMode ?? 'edge',
        swipeThreshold: this.opts.swipeThreshold,
      },
    );

    // Keyboard
    if (keyboardConfig.enabled !== false) {
      this.keyboardCleanup = attachKeyboardListeners(
        this.container,
        () => this.orientations[this.currentFace]!.rollSteps,
        {
          onEdge: (i) => { void this.navigateEdge(i); },
          onDirection: (dir) => { void this.navigate(dir); },
        },
        keyboardConfig,
      );
    }
  }
}
