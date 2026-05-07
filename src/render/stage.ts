import type { FaceModel, FaceFrame } from '../core/projector';
import { buildClipPath, buildSafeAreaPadding } from './clip';

export interface StageElements {
  root: HTMLElement;
  stage: HTMLElement;
  faces: HTMLElement[];
  viewports: HTMLElement[];
  contents: HTMLElement[];
  controlsRoot: HTMLElement;
  liveRegion: HTMLElement;
}

export interface StageOptions {
  faceCount: number;
  className?: string;
  background?: string | null;
  safeAreaPadding: boolean;
}

/**
 * Build the DOM skeleton inside the user-provided container.
 * Only structural elements; interactivity is wired elsewhere.
 */
export function buildStage(container: HTMLElement, opts: StageOptions): StageElements {
  // Reset container.
  container.classList.add('pf-root');
  if (opts.className) container.classList.add(opts.className);
  if (opts.background != null) container.style.background = opts.background;
  container.innerHTML = '';

  const stage = document.createElement('div');
  stage.className = 'pf-stage';
  container.appendChild(stage);

  const faces: HTMLElement[] = [];
  const viewports: HTMLElement[] = [];
  const contents: HTMLElement[] = [];

  for (let i = 0; i < opts.faceCount; i++) {
    const face = document.createElement('div');
    face.className = `pf-face pf-face--${i}`;
    face.setAttribute('data-face', String(i));

    const viewport = document.createElement('div');
    viewport.className = 'pf-face__viewport';

    const content = document.createElement('div');
    content.className = 'pf-face__content';

    viewport.appendChild(content);
    face.appendChild(viewport);
    stage.appendChild(face);

    faces.push(face);
    viewports.push(viewport);
    contents.push(content);
  }

  const controlsRoot = document.createElement('div');
  controlsRoot.className = 'pf-controls';
  controlsRoot.setAttribute('aria-hidden', 'false');
  container.appendChild(controlsRoot);

  const liveRegion = document.createElement('div');
  liveRegion.className = 'pf-sr-only';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('role', 'status');
  container.appendChild(liveRegion);

  // Tab focusable.
  if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '0');

  return { root: container, stage, faces, viewports, contents, controlsRoot, liveRegion };
}

export interface ApplyStageOptions {
  models: readonly FaceModel[];
  frames: readonly FaceFrame[];
  activeFace: number;
  /** Z-index baseline. */
  baseZ?: number;
  safeAreaPadding: boolean;
}

/**
 * Apply per-face transforms, opacity, z-index and clip-path/dimensions.
 */
export function applyStage(elements: StageElements, opts: ApplyStageOptions): void {
  const { faces, viewports } = elements;
  const baseZ = opts.baseZ ?? 0;

  // Sort indices by depth ascending: smaller depth (more negative viewZ, farther
  // from camera) gets the lower z-index so closer faces render on top.
  const depthOrder = opts.frames
    .map((f, i) => ({ i, depth: f.depth }))
    .sort((a, b) => a.depth - b.depth);
  const zIndexMap = new Map<number, number>();
  depthOrder.forEach((d, k) => zIndexMap.set(d.i, baseZ + k));

  for (let i = 0; i < faces.length; i++) {
    const face = faces[i]!;
    const viewport = viewports[i]!;
    const model = opts.models[i]!;
    const frame = opts.frames[i]!;

    // Bounding rectangle dimensions
    face.style.setProperty('--pf-face-w', `${model.width}px`);
    face.style.setProperty('--pf-face-h', `${model.height}px`);

    face.style.transform = frame.transform;
    face.style.opacity = String(frame.opacity);
    face.style.zIndex = String(zIndexMap.get(i) ?? baseZ);
    face.style.clipPath = buildClipPath(model);
    (face.style as unknown as { webkitClipPath: string }).webkitClipPath = buildClipPath(model);

    if (i === opts.activeFace) face.classList.add('pf-face--active');
    else face.classList.remove('pf-face--active');

    // Safe-area padding — applied to the viewport so user content lands inside.
    if (opts.safeAreaPadding) {
      const safe = buildSafeAreaPadding(model);
      viewport.style.setProperty('--pf-safe-area-top', `${safe.top}px`);
      viewport.style.setProperty('--pf-safe-area-right', `${safe.right}px`);
      viewport.style.setProperty('--pf-safe-area-bottom', `${safe.bottom}px`);
      viewport.style.setProperty('--pf-safe-area-left', `${safe.left}px`);
    } else {
      viewport.style.removeProperty('--pf-safe-area-top');
      viewport.style.removeProperty('--pf-safe-area-right');
      viewport.style.removeProperty('--pf-safe-area-bottom');
      viewport.style.removeProperty('--pf-safe-area-left');
    }
  }
}

export function destroyStage(elements: StageElements): void {
  elements.root.classList.remove('pf-root');
  elements.root.removeAttribute('tabindex');
  elements.root.innerHTML = '';
}
