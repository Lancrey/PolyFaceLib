// Public entrypoint for the polyfacelib package.

export { PolyFaceLib } from './public-api';
export type {
  PolyFaceLibOptions,
  InteractionConfig,
  AnimationConfig,
  CurrentFace,
} from './public-api';

export { Polyhedra, cube, tetrahedron, octahedron, dodecahedron, icosahedron, prism } from './polyhedra/presets';
export type { PrismOptions } from './polyhedra/presets';

export type {
  Polyhedron,
  PolyhedronFace,
  ValidationOptions,
  ValidationResult,
} from './polyhedra/polyhedron';
export { validatePolyhedron, faceCentroid, faceNormal } from './polyhedra/polyhedron';

export type { FaceContent, TextFaceContent, ImageFaceContent, HtmlFaceContent, ComponentFaceContent } from './faces/face-content';

export type { TransparencyConfig, TransparencyCurve } from './transparency/depth-opacity';

export type { KeyboardConfig, KeyboardMode } from './input/keyboard';
export type { ControlsMode } from './input/controls';
export type { PointerOptions } from './input/pointer';

export type { BreakpointsConfig, SizingMode, Breakpoint } from './render/responsive';

export type {
  PersistenceConfig,
  PersistedState,
  StorageAdapter,
  PersistField,
} from './persistence/persistence';

export type {
  EventMap,
  EventName,
  Listener,
} from './events';

export { sync } from './sync/sync';
export type { SyncMode, SyncOptions, SyncEvent, SyncLink } from './sync/sync';

export { Easing } from './core/animator';
export type { EasingFn } from './core/animator';

export type { Vec3 as Vec3T } from './core/math/vec3';
export type { Quat as QuatT } from './core/math/quat';
export type { Mat4 as Mat4T } from './core/math/mat4';
