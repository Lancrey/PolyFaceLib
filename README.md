Why PolyFaceLib?
Most 3D content viewers on the web fall into two camps: heavy WebGL frameworks like Three.js (great for scenes, overkill for UI), or CSS transform-style: preserve-3d tricks (limited, fragile, browser-dependent). PolyFaceLib takes a third path: a proprietary 3D engine that computes its own perspective math and animations, then projects them onto real DOM elements as matrix3d() transforms. The result is a viewer where every face is a fully interactive HTML container — with native scrolling, full CSS support, working forms, embedded videos, accessible keyboard navigation — wrapped in a true 3D presentation that you control end to end.
It's not a 3D scene library. It's a navigation primitive: organize your content on the faces of a polyhedron, and let users rotate through it.

Highlights

Proprietary 3D engine. No Three.js, no WebGL, no transform-style: preserve-3d. All math (quaternions, perspective projection, animation curves, transition solver) lives in the library.
Real DOM faces. Each face is a regular HTML element. Native scroll, all CSS properties, working interactivity, screen-reader friendly.
Any convex polyhedron. Cube, tetrahedron, octahedron, dodecahedron, icosahedron, parametric prisms — or define your own with vertices and faces.
Multiple navigation modes. Click an edge, swipe (with smart scroll/swipe disambiguation), on-screen controls, keyboard arrows, or numeric keys. All cumulable.
Readable orientation guarantee. Every transition leaves the destination face right-side up — text never lands upside down, no matter the rotation path.
Graduated transparency. Optionally fade faces by depth, with linear, smoothstep, or custom curves.
Multi-view synchronization. Link several views in parallel, mirror, opposite-face, or custom-mapped modes.
State persistence. Save face position and per-face scroll across sessions via localStorage, sessionStorage, or a custom adapter (IndexedDB, remote backend, …).
Responsive. Adapts to mobile, tablet, desktop, and ultra-wide via ResizeObserver and configurable breakpoints, with WCAG-compliant touch targets.
Zero runtime dependencies. Pure TypeScript, ESM + CJS + UMD, < 35 KB minified+gzipped.


Installation
bashnpm install polyfacelib
tsimport { PolyFaceLib, Polyhedra } from 'polyfacelib';
import 'polyfacelib/styles.css';

Quick start
tsconst view = new PolyFaceLib({
  container: '#viewer',
  polyhedron: Polyhedra.cube(),
  initialFace: 0,
  transparency: { enabled: true, nearOpacity: 0.4, farOpacity: 0.9, curve: 'smoothstep' },
});

view.setFace(0, { type: 'text', text: 'Front' });
view.setFace(1, { type: 'image', src: '/photo.jpg', fit: 'cover' });
view.setFace(2, { type: 'html', html: '<h1>Dashboard</h1><p>...</p>' });
view.setFace(3, { type: 'component', mount: (el) => mountReactApp(el) });

view.start();
That's it. Click an edge to navigate, swipe on touch devices, use arrow keys when focused.

Core concepts
The polyhedron model
A polyhedron is defined by a list of 3D vertices and a list of faces (each face is an ordered list of vertex indices forming a polygon). PolyFaceLib accepts any convex polyhedron — adjacency, normals, canonical orientations, and the navigation transition graph are all computed automatically at initialization from this minimal definition.
Built-in presets cover the five Platonic solids and parametric prisms. For anything else, supply your own:
tsconst customSolid = {
  vertices: [/* Vec3[] */],
  faces: [
    { vertexIndices: [0, 1, 2, 3], upHint: [0, 1, 0] },
    // ...
  ],
};
const view = new PolyFaceLib({ container: '#v', polyhedron: customSolid });
The library validates convexity, topological closure (every edge shared by exactly two faces), and Euler's formula at boot, with clear error messages if your definition is malformed.
Navigation
Each face is divided into N triangular zones (one per edge), radiating from the centroid outward, with a configurable central dead zone reserved for content interaction (scroll, clicks inside the face). Clicking — or swiping toward — an edge zone navigates to the face adjacent across that edge. The cube rotates via quaternion slerp, with the destination face always landing in a readable orientation thanks to a transition solver that precomputes the correct target rotation for every (face, roll, edge) triple at init time.
Rendering pipeline
Each animation frame, PolyFaceLib:

Advances the current quaternion via slerp(from, to, easedT).
Transforms each face's vertices into world space.
Builds the final 4×4 matrix combining rotation, camera translation, and perspective division — entirely in our code, no CSS perspective involved.
Sorts faces by depth for correct transparency compositing.
Writes the resulting matrix3d(…) string and computed opacity to each face's DOM element.

The browser's only job is to rasterize the final 2D output of our matrix. The 3D pipeline is ours.

Face content
Four content types, all sharing the same underlying DOM structure (a viewport with native overflow scrolling):
ts// Plain text, rendered as styled DOM
view.setFace(0, { type: 'text', text: 'Hello', className: 'my-face-text' });

// Image with object-fit
view.setFace(1, { type: 'image', src: '/img.jpg', fit: 'cover' });

// Arbitrary HTML — string or DOM element
view.setFace(2, { type: 'html', html: '<form>...</form>' });
view.setFace(3, { type: 'html', element: document.getElementById('panel') });

// Mount callback for framework integration
view.setFace(4, {
  type: 'component',
  mount: (faceContentEl) => {
    const root = ReactDOM.createRoot(faceContentEl);
    root.render(<MyComponent />);
    return () => root.unmount();
  },
});
All faces support full CSS (Grid, Flexbox, position: sticky inside the viewport, animations, filters, backdrop-filter, etc.), native overflow scrolling when content exceeds the face, and full keyboard/pointer interactivity on the active face.
For non-rectangular faces (triangles, pentagons, …), the library generates a clip-path: polygon(…) matching the face shape and exposes the largest inscribed rectangle as a CSS variable, so rectangular content can opt into a guaranteed safe area.

Interaction modes
tsnew PolyFaceLib({
  container: '#v',
  polyhedron: Polyhedra.cube(),
  interaction: {
    edgeClick: true,                                   // click on a face edge to navigate
    swipe: true,                                       // touch/pointer swipe gestures
    swipeMode: 'edge',                                 // 'edge' | 'twoFingers' | 'always'
    controls: 'edges',                                 // 'none' | 'edges' | 'buttons' | 'both'
    keyboard: { enabled: true, mode: 'arrows' },       // 'arrows' | 'numeric' | 'tab'
  },
});
The swipe mode resolves the classic conflict between in-face scrolling and cube navigation: by default, swipes starting in the peripheral edge zones navigate the cube, while swipes starting in the central content area scroll the face natively. Two-finger and always-navigate modes are also available.
For polyhedra with many edges per face (pentagons, hexagons), keyboard.mode: 'numeric' lets users press 1–N to select an edge directly — particularly useful when touch zones become small on mobile.

Transparency
tsnew PolyFaceLib({
  container: '#v',
  polyhedron: Polyhedra.dodecahedron(),
  transparency: {
    enabled: true,
    nearOpacity: 0.3,         // closest face is most transparent
    farOpacity: 0.9,          // farthest face is most opaque
    curve: 'smoothstep',      // 'linear' | 'smoothstep' | (t) => number
    cullBackFaces: false,     // if true, hide back-facing instead
  },
});
Each face's opacity is computed from its depth relative to the viewer, allowing back faces to remain visible through front ones — a useful effect for revealing content layered behind the active face.

Multi-view synchronization
Link multiple views to react to each other:
tsimport { PolyFaceLib, sync, Polyhedra } from 'polyfacelib';

const a = new PolyFaceLib({ container: '#left',  polyhedron: Polyhedra.cube() });
const b = new PolyFaceLib({ container: '#right', polyhedron: Polyhedra.cube() });

const link = sync([a, b], {
  mode: 'mirror',           // 'parallel' | 'mirror' | 'opposite' | 'custom'
  syncScroll: true,
  syncAnimation: true,      // both views animate in the same frame
});

link.pause();
link.resume();
link.unsync();
Custom mode accepts a map callback for arbitrary mappings — useful when linking polyhedra of different types (e.g., a cube driving a dodecahedron). Bidirectional propagation is the default; pass master: a for one-way control. Feedback loops are guarded against internally.

State persistence
Save face position and per-face scroll across page reloads:
tsnew PolyFaceLib({
  container: '#v',
  polyhedron: Polyhedra.cube(),
  persistence: {
    enabled: true,
    storage: 'localStorage',                          // or 'sessionStorage' or a custom adapter
    key: 'my-app:viewer',
    persist: ['face', 'scroll'],
    debounce: 300,
    schemaVersion: 2,
    migrate: (old, oldVersion) => /* ... */,
    onError: (err, op) => console.warn(`Storage ${op} failed`, err),
  },
});

await view.ready;   // resolves once async restoration completes (if any)
Bring your own storage with the StorageAdapter interface (get/set/remove, sync or async) — works with IndexedDB, remote backends, cookies, or anything else. If storage is unavailable (Safari private mode, quota exceeded, opt-out), the library transparently falls back to in-memory state without breaking.

Responsive design
A ResizeObserver watches the container and recomputes face matrices, click zones, and clip paths on every resize. Three sizing modes (fit, fill, fixed) cover most layouts.
Breakpoints adjust default behavior automatically:
BreakpointWidthDefaultsMobile< 640pxcontrols: 'edges', swipeMode: 'edge', ≥ 44px touchTablet640–1024controls: 'edges', swipe + clickDesktop> 1024controls: 'none', swipe + click + keyboard
For polyhedra with many edges per face, the library detects when touch zones would fall below WCAG's 44px minimum on mobile and automatically suggests fallback modes (numeric keyboard, button overlay).
prefers-reduced-motion is respected by default — animations shrink to 0–100ms when the user has indicated a preference.

API at a glance
ts// Lifecycle
view.start(); view.stop(); view.resize(); view.destroy();

// Navigation
await view.navigateEdge(edgeIndex);
await view.navigateDirection(angleRadians);
await view.navigate('right' | 'left' | 'up' | 'down');
await view.goToFace(index, { animate: true });
view.getCurrentFace();   // { index, roll, rollSteps }
view.getFaceCount();

// Scroll
view.scrollFace(faceIndex, x, y);
view.getFaceScroll(faceIndex);

// Persistence
view.persist(); view.restore(); view.clearPersisted();
await view.ready;

// Events
view.on('beforeNavigate' | 'afterNavigate' | 'faceClick' |
        'faceScroll'    | 'resize'        | 'animationFrame', handler);
Full API reference and TypeScript definitions are bundled with the package.

Browser support
Modern evergreen browsers (Chrome, Firefox, Safari, Edge — last two major versions). Required APIs: ES2020, Pointer Events, ResizeObserver, CSS clip-path: polygon(), CSS matrix3d(). No polyfills shipped.

Why not Three.js?
Three.js is a fantastic 3D scene library, but it's the wrong tool for a UI navigation primitive:

Bundle size. Three.js ships ~600 KB minified. PolyFaceLib's core is < 35 KB.
Interactivity. Content rendered in a WebGL canvas isn't real DOM — no native scroll, no form inputs, no copy-paste, no accessibility tree without extensive custom work.
CSS. You can't apply your stylesheet to a WebGL texture.

Three.js is the right answer when your content is a 3D scene. PolyFaceLib is the right answer when your content is HTML and you want to organize it spatially.

Why not CSS preserve-3d?
CSS 3D transforms with preserve-3d delegate the 3D math to the browser's CSS engine, with several issues:

Inconsistent rendering across browsers (especially around z-index sorting and sub-pixel artifacts).
No control over perspective math, animation curves, or transition timing.
No transition solver — you can't guarantee that text lands right-side up after arbitrary rotation paths.
Limited animation — CSS transitions can't easily implement quaternion slerp.

PolyFaceLib computes everything in TypeScript and outputs the final matrix3d() itself, sidestepping all of this.

Roadmap

v0.2: Official React, Vue, and Svelte wrappers; touch gesture refinement; cross-tab sync via BroadcastChannel.
v0.3: Non-convex polyhedra support; runtime polyhedron mutation (add/remove faces); morphing transitions between polyhedra.
v1.0: API stability commitment, semver guarantees, comprehensive accessibility audit.


Contributing
Issues and pull requests welcome. See CONTRIBUTING.md for development setup, coding standards, and the test methodology for the transition solver.

