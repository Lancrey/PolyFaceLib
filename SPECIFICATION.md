# Specification — PolyFaceLib Library

Specification intended for Claude Code for the implementation of a navigable **polyhedral** visualization library, distributed on npm and GitHub.

---

## 1. Vision

JS/TS library providing a visualization component where content is organized on the faces of an **arbitrary polyhedron** (cube, tetrahedron, octahedron, dodecahedron, icosahedron, prisms, or custom polyhedron defined by the user). Navigation between faces is performed by interacting with the edges of the visible face (click, gesture, controls), triggering an animated rotation of the polyhedron.

**Target audience:** developers integrating the component into their web projects (vanilla, React, Vue, Svelte, etc.).

**Structuring constraints:**
- **Proprietary 3D engine**: 3D math, perspective projection, animations, navigation and transparency are **entirely** computed by the library. No dependency on Three.js / WebGL / `transform-style: preserve-3d`.
- **Hybrid DOM rendering**: the library produces a `matrix3d()` matrix per face applied to a real DOM element. Native scroll, all CSS, full interactivity.
- **Arbitrary polyhedron**: cube, predefined Platonic solids, parametric prisms, or custom polyhedron defined by vertices + faces.
- npm distribution in vanilla TypeScript, no runtime dependencies.
- Framework-agnostic API, responsive and touch-enabled by default.

---

## 2. Tech stack

| Element | Choice |
|---|---|
| Language | Strict TypeScript |
| Compilation target | ES2020 + ESM + CJS + UMD |
| Rendering | DOM + CSS `transform: matrix3d(…)` computed by the proprietary engine |
| 3D math | Internal implementation (Vec3, Mat4, Quat, perspective projection) |
| Inputs | Pointer Events API + KeyboardEvent |
| Observability | `ResizeObserver` |
| Build | `tsup` (ESM/CJS/d.ts) |
| Tests | `vitest` + `@vitest/browser` |
| Lint/format | `eslint` + `prettier` |
| Docs | `typedoc` + Vite demo site |
| CI | GitHub Actions |
| Runtime dependencies | **None** |

---

## 3. Package architecture

```
polyfacelib/
├── src/
│   ├── core/
│   │   ├── math/            # vec3, mat4, quat, projection
│   │   ├── projector.ts     # 3D → matrix3d CSS
│   │   ├── animator.ts      # rotation interpolation (slerp)
│   │   └── frame.ts         # rAF loop
│   ├── polyhedra/
│   │   ├── polyhedron.ts    # Polyhedron type + validation
│   │   ├── adjacency.ts     # face↔edge↔face graph computation
│   │   ├── orientations.ts  # canonical orientation computation
│   │   ├── transitions.ts   # transition table generator
│   │   └── presets/
│   │       ├── cube.ts
│   │       ├── tetrahedron.ts
│   │       ├── octahedron.ts
│   │       ├── dodecahedron.ts
│   │       ├── icosahedron.ts
│   │       └── prism.ts     # parametric prism (n sides)
│   ├── input/
│   │   ├── pointer.ts       # click + swipe
│   │   ├── keyboard.ts
│   │   ├── controls.ts      # UI controls (1 per edge)
│   │   └── zones.ts         # face split into N triangles (1/edge) + dead zone
│   ├── render/
│   │   ├── stage.ts         # DOM creation (container + N faces)
│   │   ├── clip.ts          # CSS clip-path per face shape
│   │   └── responsive.ts    # ResizeObserver + breakpoints
│   ├── faces/
│   │   ├── face-content.ts  # setFace API
│   │   ├── text.ts
│   │   ├── image.ts
│   │   ├── html.ts
│   │   └── component.ts
│   ├── transparency/
│   │   └── depth-opacity.ts
│   ├── public-api.ts
│   └── index.ts
├── examples/
├── tests/
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE                  # MIT
```

---

## 4. Polyhedron model

### 4.1 Generic definition

```ts
interface Polyhedron {
  vertices: Vec3[];                    // vertices in 3D coordinates
  faces: PolyhedronFace[];             // vertex order: clockwise viewed from outside
}

interface PolyhedronFace {
  vertexIndices: number[];             // indices in `vertices`, ≥ 3
  upHint?: Vec3;                       // canonical "semantic up" direction (optional)
  id?: string;                         // user identifier (otherwise: index)
}
```

**Validation constraints (at init):**
- **Convex** polyhedron only in v1 (check: all vertices on the same side of each face). Non-convex cases → warning + behavior not guaranteed.
- Each edge is shared by exactly 2 faces (topological check).
- Faces ≥ 3 vertices, planar (configurable tolerance).

### 4.2 Derived computations (done once at init)

For each face:
- `center`: centroid (mean of vertices).
- `normal`: cross product of the first two edges, normalized.
- `edges`: list of edges (pairs of consecutive vertices) with, for each, the index of the adjacent face.
- `canonicalOrientation`: quaternion that brings this face camera-facing with its `upHint` aligned with the screen top.
- `inscribedRect`: largest inscribed rectangle (used to position rectangular content if the user wishes).

### 4.3 Adjacency

The adjacency graph `(face, edgeIndex) → (faceAdj, edgeIndexInFaceAdj)` is computed at init via an edge hash table (key: sorted pair of vertices).

---

## 5. Predefined polyhedra

| Preset | Faces | Face shape | Symmetries |
|---|---|---|---|
| `'cube'` | 6 | square | 24 orientations |
| `'tetrahedron'` | 4 | equilateral triangle | 12 |
| `'octahedron'` | 8 | equilateral triangle | 24 |
| `'dodecahedron'` | 12 | regular pentagon | 60 |
| `'icosahedron'` | 20 | equilateral triangle | 60 |
| `'prism'` | n+2 | n-gon (top/bottom) + n rectangles (sides) | parametric |

Factory API:

```ts
import { Polyhedra } from 'polyfacelib';

const cube       = Polyhedra.cube();
const tetra      = Polyhedra.tetrahedron();
const dodec      = Polyhedra.dodecahedron();
const hexPrism   = Polyhedra.prism({ sides: 6, height: 1 });

// Custom:
const custom: Polyhedron = {
  vertices: [...],
  faces: [
    { vertexIndices: [0, 1, 2, 3], upHint: [0, 1, 0] },
    ...
  ]
};
```

---

## 6. Hybrid rendering engine

### 6.1 Per-frame pipeline

1. **State update**: `Quat.slerp(from, to, easedT)`.
2. **Application**: for each face, transform its local vertices into world coordinates.
3. **Proprietary perspective projection**: final 4×4 matrix combining rotation + camera translation + perspective. **Internal computation**, no CSS `perspective:`.
4. **Depth sorting**: face sorting by z-centroid, translated into DOM `z-index`.
5. **Application to DOM**:
   ```ts
   faceEl.style.transform     = `matrix3d(${m.join(',')})`;
   faceEl.style.opacity       = computedOpacity;
   faceEl.style.zIndex        = depthOrder;
   faceEl.style.pointerEvents = isActiveFace ? 'auto' : 'none';
   ```

### 6.2 UX consequences

- ✅ Native `overflow: auto` scroll inside each face.
- ✅ All CSS applicable, full interactivity.
- ⚠️ Inactive faces have `pointer-events: none`.

### 6.3 Required math

- `Vec3`, `Vec4`, `Mat4`, `Quat` (slerp included).
- `Mat4.toCSSMatrix3d(m): string` — column-major serialization (CSS standard).

---

## 7. Navigation logic

### 7.1 State model

The polyhedron has a rotation represented by a `currentRotation` quaternion. At any moment, the lib derives `(visible_face, roll)` from the quaternion. The `roll` is quantized into N positions where N = number of edges of the face (cube: 4 rolls; triangle: 3 rolls; pentagon: 5 rolls).

### 7.2 Dynamically generated transition table

At init, a solver produces the table `(face, roll, edgeClicked) → (faceAdj, rollAdj, quaternionTarget)` from the adjacency graph and canonical orientations.

**Key invariant rule:** the destination face is always in a readable orientation (`upHint` aligned with screen top). The target quaternion is precomputed to satisfy this rule.

Indicative sizes: cube 96, tetrahedron 36, octahedron 72, dodecahedron 300, icosahedron 360.

### 7.3 Interaction modes

```ts
interaction: {
  edgeClick: boolean,                                        // default: true
  swipe: boolean,                                            // default: true
  swipeMode: 'edge' | 'twoFingers' | 'always',               // default: 'edge'
  controls: 'none' | 'edges' | 'buttons' | 'both',           // default by breakpoint
  keyboard: KeyboardConfig,                                  // see 7.3.4
}
```

#### 7.3.1 Edge click (generalized)

The active face is divided into **N triangles** from the centroid to each edge (N = number of edges of the face):
- Each triangle corresponds to an edge → navigate to the adjacent face.
- `centerDeadZone` (default 60% of inradius): central zone reserved for content scroll/interaction.
- Triangular zones cover only the peripheral ring.

#### 7.3.2 Swipe gestures

- `pointerdown` in the peripheral ring + movement > `swipeThreshold` (default 30 px) → **target edge detection**: compute the angle of the swipe vector and select the edge whose 2D-projected normal is closest to that angle. Navigate to that edge.
- `pointerdown` in the central zone → native content scroll, no interception.

`'twoFingers'` and `'always'` modes as previously specified.

#### 7.3.3 UI controls

- `'edges'`: one chevron per edge, positioned at the midpoint of the edge, oriented outward. The number adapts to the current face.
- `'buttons'`: overlay button panel. For complex polyhedra, adaptive layout (buttons arranged in a circle around a central point).
- Customization via `.pf-control`, `.pf-control--edge-{i}` classes.

#### 7.3.4 Keyboard

```ts
keyboard: {
  enabled: boolean,
  mode: 'arrows' | 'numeric' | 'tab',  // default: 'arrows'
}
```

- `'arrows'`: arrow keys mapped to the 4 edges closest to the cardinal directions (works natively for cube/prisms; approximate mapping for other polyhedra).
- `'numeric'`: keys `1`–`N` select edge `i` (useful for pentagon, hexagon…).
- `'tab'`: `Tab`/`Shift+Tab` cycle through edges; `Enter` confirms.

### 7.4 Animation

- Default duration `400ms`, `easeInOutCubic` easing, `Quat.slerp`.
- Inputs ignored during animation (or queued if `queueInputs: true`).

---

## 8. Non-rectangular faces: clipping and scroll

### 8.1 DOM structure per face

```html
<div class="pf-face pf-face--{i}" data-face="{i}" style="clip-path: polygon(...)">
  <div class="pf-face__viewport">
    <div class="pf-face__content">
      <!-- user content -->
    </div>
  </div>
</div>
```

- `.pf-face`: transformed element, **rectangular** = bounding box of the polygonal face, **clipped** by CSS `clip-path: polygon(...)` to match the actual shape (triangle, pentagon…).
- `.pf-face__viewport`: `width:100%; height:100%; overflow:auto;` — scrolls within the bounding box.
- `.pf-face__content`: user content, free size.

### 8.2 Safe zone for content

- For non-rectangular faces, the lib exposes the `inscribedRect` (rectangle inscribed in the polygon) via a `--pf-safe-area` CSS variable.
- An opt-in `safeAreaPadding: boolean` (default `true`) automatically applies padding aligning `.pf-face__content` to the inscribed rect, ensuring rectangular content is not truncated by the clip-path.
- If `safeAreaPadding: false`, the user manages their own layout (useful for content that intentionally follows the face shape).

### 8.3 CSS freedom

The user can target `.pf-face__content` and use:
- Additional `clip-path` if more complex shapes are needed.
- Exposed CSS variables: `--pf-face-size`, `--pf-face-sides`, `--pf-rotation-progress`, `--pf-current-face`, `--pf-safe-area-{top|right|bottom|left}`.
- Any CSS rule (Grid, Flex, sticky in the scrollable viewport, animations…).

### 8.4 Scroll

- Scroll position remembered per face between navigations.
- `resetScrollOnNavigate: boolean` (default `false`).

---

## 9. Responsive

### 9.1 Size adaptation

`ResizeObserver` on the container. Sizing policy (`sizing`):
- `'fit'` (default): polyhedron = `min(width, height)` of the container.
- `'fill'`: fills the container.
- `'fixed'`: fixed px.

Recomputation of matrices, clip-path per face, and click zones on each resize.

### 9.2 Behavioral breakpoints

| Breakpoint | Width | Default behaviors |
|---|---|---|
| `mobile` | < 640px | `controls: 'edges'`, `swipeMode: 'edge'`, touch zones ≥ 44px |
| `tablet` | 640–1024px | `controls: 'edges'`, swipe + click |
| `desktop` | > 1024px | `controls: 'none'`, swipe + click + keyboard |

**Adaptation for polyhedra with many faces:** on mobile, if number of edges per face × `centerDeadZone` makes touch zones < 44px, the lib:
1. enlarges the polyhedron (`sizing: 'fill'`),
2. failing that, emits a dev warning,
3. suggests the user use `keyboard.mode: 'numeric'` or `controls: 'buttons'` as alternatives.

### 9.3 Accessibility

- Localizable `aria-label` on all controls.
- Focusable component (Tab).
- `aria-live="polite"` to announce face changes.
- WCAG: click zones ≥ 44×44 px on mobile.
- Respect for `prefers-reduced-motion` (option `prefersReducedMotion: 'auto'`).

---

## 10. Gradual transparency system

```ts
interface TransparencyConfig {
  enabled: boolean;
  nearOpacity: number;   // default 0.3
  farOpacity: number;    // default 0.9
  curve: 'linear' | 'smoothstep' | ((t: number) => number);
  cullBackFaces: boolean;
}
```

For each face: `t = (depth - minDepth) / (maxDepth - minDepth)`, `opacity = lerp(nearOpacity, farOpacity, curve(t))`. The computation is correct for an arbitrary number of faces.

---

## 11. Public API

### 11.1 Creation

```ts
import { PolyFaceLib, Polyhedra } from 'polyfacelib';

const view = new PolyFaceLib({
  container: HTMLElement | string,
  polyhedron: Polyhedra.cube(),                // or other preset, or custom Polyhedron
  size: 'fit' | 'fill' | number,
  initialFace: number,                          // index in polyhedron.faces
  transparency: TransparencyConfig | false,
  animation: { duration?: number; easing?: EasingFn },
  perspective: number,                          // focal distance (default 800)
  background: string | null,
  interaction: InteractionConfig,
  breakpoints: BreakpointsConfig,
  resetScrollOnNavigate: boolean,
  prefersReducedMotion: 'auto' | boolean,
  centerDeadZone: number,                       // 0..1 of inradius (default 0.6)
  swipeThreshold: number,                       // px (default 30)
  safeAreaPadding: boolean,                     // default true
});
```

### 11.2 Defining face content

```ts
view.setFace(0, { type: 'text',  text: 'Hello' });
view.setFace(1, { type: 'image', src: '/img.jpg', fit: 'cover' });
view.setFace(2, { type: 'html',  html: '<h1>Title</h1>...' });
view.setFace(3, { type: 'html',  element: someElement });
view.setFace(4, {
  type: 'component',
  mount: (faceContentEl) => {
    // mount React/Vue/Svelte/…
    return () => { /* unmount */ };
  },
});
```

### 11.3 Navigation

```ts
view.navigateEdge(edgeIndex: number): Promise<void>;       // navigate by edge index of the active face
view.navigateDirection(angle: number): Promise<void>;      // navigate by 2D angle (useful for swipe)
view.navigate('right' | 'left' | 'up' | 'down'): Promise<void>;  // sugar, maps to nearest edge
view.goToFace(index: number, opts?: { animate?: boolean }): Promise<void>;
view.getCurrentFace(): { index: number; roll: number; rollSteps: number };
view.getFaceCount(): number;
view.scrollFace(face: number, x: number, y: number): void;
view.getFaceScroll(face: number): { x: number; y: number };
```

### 11.4 Events

```ts
view.on('beforeNavigate', e => { /* e.from, e.to, e.edgeIndex, e.preventDefault() */ });
view.on('afterNavigate',  e => { /* e.from, e.to */ });
view.on('faceClick',      e => { /* e.face, e.position */ });
view.on('faceScroll',     e => { /* e.face, e.x, e.y */ });
view.on('resize',         e => { /* e.width, e.height, e.size */ });
view.on('animationFrame', e => { /* e.progress */ });
```

### 11.5 Lifecycle

```ts
view.start();
view.stop();
view.resize();
view.destroy();
```

---

## 12. Multi-view synchronization

### 12.1 Overview

Multiple `PolyFaceLib` instances can be linked to propagate navigation and/or scroll actions from one view to others. Useful for:
- Side-by-side comparisons (before/after, multiple viewpoints).
- Tutorials where a "mirror" view illustrates the manipulations.
- Dashboards where multiple facets of data rotate together.

### 12.2 API

```ts
import { PolyFaceLib, sync, Polyhedra } from 'polyfacelib';

const a = new PolyFaceLib({ container: '#a', polyhedron: Polyhedra.cube() });
const b = new PolyFaceLib({ container: '#b', polyhedron: Polyhedra.cube() });

const link = sync([a, b], {
  mode: 'parallel' | 'mirror' | 'opposite' | 'custom',
  master?: PolyFaceLib,         // if defined, unidirectional propagation (default: bidirectional)
  syncScroll?: boolean,      // also sync scroll position per face (default: false)
  syncAnimation?: boolean,   // animate simultaneously (true) or sequentially (false). Default: true
  map?: (event, source, targets) => void,  // required if mode === 'custom'
});

link.pause();    // suspends synchronization
link.resume();
link.unsync();   // destroys the link
```

### 12.3 Modes

- **`'parallel'`**: the target navigates on the same edge (by index) as the source. Prerequisite: polyhedra of the same type, or at least the same number of edges on the active face.
- **`'mirror'`**: mirror navigation along a configurable axis (`axis: 'horizontal' | 'vertical'`). `right` ↔ `left`, `up` ↔ `down`.
- **`'opposite'`**: the target navigates to the opposite face (the face whose normal points opposite to the source's destination face). Canonical definition in convex geometry.
- **`'custom'`**: the `map` function receives the source event and manually applies the action on the targets.

### 12.4 Heterogeneous polyhedra

If the polyhedra are not identical (e.g. cube synced with dodecahedron), only `'custom'` mode is guaranteed. Modes `'parallel'`, `'mirror'`, `'opposite'` throw an error at init if topologies are incompatible, with a message indicating the expected mapping table.

### 12.5 Guarantees

- **No infinite feedback**: a navigation event triggered by sync is flagged and does not re-trigger the reverse sync, even in bidirectional mode.
- **Cycles**: `sync([a, b, c])` synchronizes all three together; a change on `a` propagates to `b` and `c` simultaneously (not in cascade).
- **Animation**: if `syncAnimation: true`, all views use the same `animation.duration` and start in the same `rAF` frame; visualizations stay in phase.
- **Destruction**: if a view is `destroy()`ed, the link is automatically cleaned up.

---

## 13. State persistence

### 13.1 Overview

Automatic save and restore of view state across reloads/sessions. Persistable state:
- Active face and its roll.
- Scroll position per face.
- Exact rotation (optional, for resuming during animation).

### 13.2 API

```ts
new PolyFaceLib({
  persistence: {
    enabled: boolean,
    storage: 'localStorage' | 'sessionStorage' | StorageAdapter,
    key: string,                                       // unique key, required if enabled
    persist: ('face' | 'scroll' | 'rotation')[],       // default: ['face', 'scroll']
    debounce: number,                                  // ms, default 300
    schemaVersion: number,                             // default 1
    migrate?: (old: unknown, oldVersion: number) => PersistedState | null,
    onError?: (error: Error, op: 'read' | 'write' | 'parse') => void,
  }
});
```

### 13.3 Custom storage adapter

```ts
interface StorageAdapter {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}
```

Allows IndexedDB, remote backend, cookies, or any other storage. Methods can be synchronous or asynchronous — the lib handles both.

### 13.4 Programmatic methods

```ts
view.persist();         // forces immediate save (bypasses debounce)
view.restore();         // forces restore from storage
view.clearPersisted();  // clears saved data
```

### 13.5 Lifecycle

- **Init**: if `persistence.enabled`, read storage. Data found and `schemaVersion` compatible → restore (face + scroll). Otherwise default state. Parse error → `onError` + default state.
- **Runtime**: on `afterNavigate` and `faceScroll`, debounced write (300ms by default).
- **`destroy()`**: flush pending writes.

### 13.6 Robustness

- **Storage unavailable** (Safari private mode, quota exceeded, cookie opt-out): `onError` called, silent in-memory fallback for the current session. The view remains functional.
- **Incompatible schema**: if recorded `schemaVersion` ≠ current, call `migrate()`. If not provided or returns `null`, data ignored and default state applied.
- **Async adapter**: the lib exposes `view.ready: Promise<void>` resolving after restore. While waiting, the view displays `initialFace`.
- **Multi-tab**: by default, no cross-tab sync. Possible future option via `BroadcastChannel` (out of scope v1).

### 13.7 Serialized format

```ts
interface PersistedState {
  v: number;                                  // schemaVersion
  face?: number;                              // active face index
  roll?: number;                              // roll in steps
  scroll?: Record<number, [number, number]>;  // per face index: [x, y]
  rotation?: [number, number, number, number]; // quaternion (if 'rotation' in persist)
  ts: number;                                 // write timestamp
}
```

---

## 14. Tests

- **Math**: 100% coverage on vec3/mat4/quat + projection.
- **Polyhedra**: for each preset, verify topological validity (Euler V−E+F=2), normals point outward, adjacency is consistent.
- **Transition solver**: for each preset, verify that all transitions bring a face into readable orientation and that composing N identical rotations returns to the initial state.
- **Renderer**: `matrix3d` consistent with an independent reference case.
- **Inputs**: click zones correctly partitioned for faces with 3, 4, 5 edges.
- **Clipping**: `clip-path` correctly generated for various shapes.
- **Responsive**: simulated resizes, breakpoints, fallbacks for zones < 44px.
- **Custom polyhedra**: validation rejects non-convex/non-closed with clear messages.
- **Performance**: ≥ 60 FPS on dodecahedron with rich DOM contents.

Coverage target: > 85%.

---

## 15. Documentation and examples

### `/examples/`
1. `cube-basic.html` — cube with 6 texts
2. `tetrahedron.html` — 4-faced tetrahedron
3. `dodecahedron.html` — 12-faced dodecahedron
4. `prism.html` — hexagonal prism
5. `custom-polyhedron.html` — user-defined custom polyhedron
6. `gallery.html` — photo gallery (cube)
7. `dashboard.html` — 6 interactive HTML widgets (cube)
8. `transparency.html` — gradual transparency demo
9. `long-content.html` — intra-face scroll
10. `mobile-gestures.html` — touch gestures
11. `responsive.html` — laptop/tablet/mobile adaptation
12. `react-integration.html` — React integration via `mount`
13. `synced-views.html` — multi-view sync demo (parallel + mirror)
14. `persistence.html` — localStorage persistence demo + IndexedDB adapter

---

## 16. Build and publication

```json
{
  "name": "polyfacelib",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".":            { "import": "./dist/index.js", "require": "./dist/index.cjs", "types": "./dist/index.d.ts" },
    "./styles.css": "./dist/styles.css",
    "./presets":    { "import": "./dist/presets.js", "require": "./dist/presets.cjs", "types": "./dist/presets.d.ts" }
  },
  "files": ["dist"],
  "sideEffects": ["*.css"]
}
```

Sub-export `polyfacelib/presets` allowing tree-shaking of unused solids.

CI: `ci.yml` (lint + test + build), `release.yml` (npm publish + GitHub Pages).

MIT license.

---

## 17. Acceptance criteria (Definition of Done)

- [ ] No runtime dependencies.
- [ ] Build < 35 KB minified+gzipped for the core (presets in separate tree-shakable chunks).
- [ ] 100% internal 3D engine (no Three.js, no `preserve-3d`, no CSS `perspective:`).
- [ ] Correct polyhedral validation (convexity, closure, adjacency).
- [ ] Generic transition solver functional for any convex polyhedron.
- [ ] All transitions bring a face into readable orientation (tested for the 5 Platonic solids + 1 custom).
- [ ] Correct gradual transparency for N faces.
- [ ] 4 content types (text, image, html, component) work.
- [ ] Native intra-face scroll operational without interfering with navigation.
- [ ] Clip-path correctly generated for non-rectangular faces.
- [ ] Scroll position remembered per face.
- [ ] All standard CSS applicable to content.
- [ ] Navigation: edge click, swipe, UI controls, keyboard (3 modes) — all functional.
- [ ] Correct adaptation mobile/tablet/desktop/ultra-wide, including for polyhedra with many faces.
- [ ] Respect for `prefers-reduced-motion`.
- [ ] Test coverage > 85%.
- [ ] Multi-view sync operational in all 4 modes (parallel, mirror, opposite, custom), bidirectional and unidirectional, no infinite feedback.
- [ ] State persistence functional: localStorage, sessionStorage and custom adapter (tested with IndexedDB), with debounce, schema migration and in-memory fallback if storage unavailable.
- [ ] 14 standalone HTML demos.
- [ ] README, online demo, npm published, GitHub Pages deployed.

---

## 18. Out of scope (v1)

- **Non-convex** polyhedra: warning emitted, behavior not guaranteed.
- Official framework wrappers (React/Vue) — v0.2.
- WebGL mode — explicitly excluded.
- Dynamic polyhedra (faces added/removed at runtime) — not planned.
- Morphing animation between polyhedra — not planned.
- Cross-tab sync via `BroadcastChannel` — not planned (the user can wire it via events and `view.persist()`).

---

## 19. Notes for Claude Code

- **Implementation order:** math → Polyhedron definition + validation → adjacency → canonical orientations → transition solver → matrix3d projector → animator → DOM stage + clip-path → frame loop → input pointer/keyboard/controls → public API → face contents → scroll/CSS → responsive (breakpoints + fallbacks) → transparency → presets (cube first, then tetrahedron, then the rest) → multi-view sync → **state persistence** → tests → docs → examples.
- **Strict TypeScript:** `strict: true`, `noUncheckedIndexedAccess: true`, no `any`.
- **Generic-first:** all code must work for an arbitrary polyhedron; the cube is a special case, not the baseline.
- **Transition solver:** invest time there — it's the central algorithmic piece. Exhaustive tests essential (verify that any sequence of N identical navigations on an N-edged face returns to the starting state).
- **JSDoc** on every public function.
- **Tree-shaking:** presets are independent modules; import only what you use.
- **No polyfills**: modern browsers (Chrome/Firefox/Safari/Edge from the last 2 years).
