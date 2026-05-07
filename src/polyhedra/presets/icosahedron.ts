import { Vec3 } from '../../core/math/vec3';
import type { Vec3 as Vec3T } from '../../core/math/vec3';
import type { Polyhedron, PolyhedronFace } from '../polyhedron';

/**
 * Regular icosahedron based on the golden-ratio rectangle construction:
 * 12 vertices, 20 triangular faces.
 */
export function icosahedron(): Polyhedron {
  const phi = (1 + Math.sqrt(5)) / 2;

  const raw: Vec3T[] = [
    [-1,  phi,  0], // 0
    [ 1,  phi,  0], // 1
    [-1, -phi,  0], // 2
    [ 1, -phi,  0], // 3
    [ 0, -1,  phi], // 4
    [ 0,  1,  phi], // 5
    [ 0, -1, -phi], // 6
    [ 0,  1, -phi], // 7
    [ phi,  0, -1], // 8
    [ phi,  0,  1], // 9
    [-phi,  0, -1], // 10
    [-phi,  0,  1], // 11
  ];

  // Normalize so vertices lie on a unit sphere (helps with rendering size)
  const vertices: Vec3T[] = raw.map(v => Vec3.normalize(v));

  // Triangle indices, oriented clockwise viewed from outside (after we re-orient if needed).
  // We list them from a known reference; the validator will check normals point outward.
  const tris = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];

  // Re-orient each triangle clockwise from outside: normal of (a,b,c) should
  // point away from origin (outward).
  const faces: PolyhedronFace[] = tris.map((t, i) => {
    const a = vertices[t[0]!]!;
    const b = vertices[t[1]!]!;
    const c = vertices[t[2]!]!;
    const n = Vec3.cross(Vec3.sub(b, a), Vec3.sub(c, a));
    const center = Vec3.scale(Vec3.add(Vec3.add(a, b), c), 1 / 3);
    // For clockwise-from-outside ordering, cross(b-a, c-a) points inward — we flip if needed.
    if (Vec3.dot(n, center) > 0) {
      return { vertexIndices: [t[0]!, t[2]!, t[1]!], upHint: [0, 1, 0] as const, id: `face-${i}` };
    }
    return { vertexIndices: [t[0]!, t[1]!, t[2]!], upHint: [0, 1, 0] as const, id: `face-${i}` };
  });

  return { vertices, faces };
}
