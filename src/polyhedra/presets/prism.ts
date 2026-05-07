import type { Polyhedron, PolyhedronFace } from '../polyhedron';
import type { Vec3 as Vec3T } from '../../core/math/vec3';

export interface PrismOptions {
  /** Number of polygon sides (>= 3). */
  sides: number;
  /** Total height of the prism along Y. Defaults to 2. */
  height?: number;
  /** Radius of the circumscribed circle for the polygon. Defaults to 1. */
  radius?: number;
}

/**
 * Right prism with regular n-gon top and bottom (in the X/Z plane), height along Y.
 * Faces: 0 = top (n-gon), 1 = bottom (n-gon), 2..n+1 = side rectangles.
 */
export function prism(opts: PrismOptions): Polyhedron {
  const sides = opts.sides;
  if (sides < 3) throw new Error(`prism: sides must be >= 3 (got ${sides}).`);
  const h = (opts.height ?? 2) / 2;
  const r = opts.radius ?? 1;

  const vertices: Vec3T[] = [];
  // Top ring (y = +h), counter-clockwise viewed from +Y → so when seen from outside (above) it's CW.
  for (let i = 0; i < sides; i++) {
    const a = (i * 2 * Math.PI) / sides;
    vertices.push([r * Math.cos(a), h, r * Math.sin(a)]);
  }
  // Bottom ring (y = -h)
  for (let i = 0; i < sides; i++) {
    const a = (i * 2 * Math.PI) / sides;
    vertices.push([r * Math.cos(a), -h, r * Math.sin(a)]);
  }

  const faces: PolyhedronFace[] = [];

  // Top face: clockwise viewed from outside (+Y), so we list in reverse order.
  const topIdx: number[] = [];
  for (let i = sides - 1; i >= 0; i--) topIdx.push(i);
  faces.push({ vertexIndices: topIdx, upHint: [0, 0, -1] as const, id: 'top' });

  // Bottom face: clockwise from outside (-Y) → that means CCW when listed in 0..n-1 order.
  const bottomIdx: number[] = [];
  for (let i = 0; i < sides; i++) bottomIdx.push(sides + i);
  faces.push({ vertexIndices: bottomIdx, upHint: [0, 0, 1] as const, id: 'bottom' });

  // Side faces: each is a rectangle (i_top, (i+1)_top, (i+1)_bottom, i_bottom)
  // Listed clockwise viewed from outside.
  for (let i = 0; i < sides; i++) {
    const iNext = (i + 1) % sides;
    faces.push({
      vertexIndices: [iNext, i, sides + i, sides + iNext],
      upHint: [0, 1, 0] as const,
      id: `side-${i}`,
    });
  }

  return { vertices, faces };
}
