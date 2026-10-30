import { Mat4 } from './mat4';

/**
 * Build a perspective projection matrix that maps view-space coordinates to
 * clip-space, but expressed for use directly as a CSS `matrix3d(...)` value.
 *
 * In CSS, the browser does *not* perform a clip-space divide for transforms
 * applied to elements: instead, the W component output is what `matrix3d`
 * passes to the rasterizer. So we use a "perspective" matrix that, combined
 * with a camera translation along -Z, produces the same visual result as
 * setting `perspective: <focal>` on a parent — but computed in our code.
 *
 * The classical "CSS perspective" matrix is:
 *
 *   1 0 0       0
 *   0 1 0       0
 *   0 0 1       0
 *   0 0 -1/d   1
 *
 * where d is the focal distance. We embed this here without relying on any
 * CSS `perspective:` declaration.
 */
export function perspectiveCSS(focal: number): Mat4 {
  const inv = focal === 0 ? 0 : -1 / focal;
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, inv,
    0, 0, 0, 1,
  ];
}

/**
 * Build the per-face transform for the renderer's "DOM 3D" pipeline.
 *
 * The output matrix M is meant to be applied as `transform: matrix3d(M)` to a
 * face element whose initial position is centered at origin in the XY plane.
 * The sequence we encode is:
 *
 *   1. Move face from local (XY plane) to its world position via `model`.
 *   2. Rotate the whole polyhedron by `rotation` (already a Mat4).
 *   3. Push it back along Z by `cameraDistance` (so the polyhedron sits in front of the camera).
 *   4. Apply our perspective division.
 *
 * The container element has its own `transform-origin: center` and is sized
 * such that origin (0,0,0) lands at the screen center.
 */
export function buildFaceTransform(
  perspective: Mat4,
  cameraTranslate: Mat4,
  rotation: Mat4,
  model: Mat4,
): Mat4 {
  return Mat4.composeChain([perspective, cameraTranslate, rotation, model]);
}
