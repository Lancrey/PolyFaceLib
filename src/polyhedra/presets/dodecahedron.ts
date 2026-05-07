import { Vec3 } from '../../core/math/vec3';
import type { Vec3 as Vec3T } from '../../core/math/vec3';
import type { Polyhedron, PolyhedronFace } from '../polyhedron';

/**
 * Regular dodecahedron: 20 vertices, 12 pentagonal faces.
 *
 * Vertex set comes from the standard golden-ratio formulation:
 *   (±1, ±1, ±1)
 *   (0, ±1/φ, ±φ)
 *   (±1/φ, ±φ, 0)
 *   (±φ, 0, ±1/φ)
 *
 * Faces are extracted by matching the 12 known pentagon vertex tuples.
 * Vertices then re-ordered to be clockwise viewed from outside.
 */
export function dodecahedron(): Polyhedron {
  const phi = (1 + Math.sqrt(5)) / 2;
  const inv = 1 / phi;

  const raw: Vec3T[] = [
    // 8 cube vertices
    [ 1,  1,  1], //0
    [ 1,  1, -1], //1
    [ 1, -1,  1], //2
    [ 1, -1, -1], //3
    [-1,  1,  1], //4
    [-1,  1, -1], //5
    [-1, -1,  1], //6
    [-1, -1, -1], //7
    // (0, ±1/φ, ±φ)
    [ 0,  inv,  phi], //8
    [ 0,  inv, -phi], //9
    [ 0, -inv,  phi], //10
    [ 0, -inv, -phi], //11
    // (±1/φ, ±φ, 0)
    [ inv,  phi, 0], //12
    [ inv, -phi, 0], //13
    [-inv,  phi, 0], //14
    [-inv, -phi, 0], //15
    // (±φ, 0, ±1/φ)
    [ phi, 0,  inv], //16
    [ phi, 0, -inv], //17
    [-phi, 0,  inv], //18
    [-phi, 0, -inv], //19
  ];

  const vertices: Vec3T[] = raw.map(v => Vec3.normalize(v));

  // 12 pentagon faces: each is a set of 5 vertex indices.
  // Reference set (commonly used dodecahedron face decomposition).
  const faceSets: number[][] = [
    [0, 8, 10, 2, 16],   // +X +Y +Z region (top-front-right)
    [0, 16, 17, 1, 12],  // +X (right)
    [0, 12, 14, 4, 8],   // +Y (top-front)
    [1, 17, 3, 11, 9],   // -Z (back lower right)
    [1, 9, 5, 14, 12],   // back top
    [2, 10, 6, 15, 13],  // -Y front (bottom-front)
    [2, 13, 3, 17, 16],  // bottom right
    [3, 13, 15, 7, 11],  // bottom back
    [4, 14, 5, 19, 18],  // -X top (top-back-left)
    [4, 18, 6, 10, 8],   // -X front
    [5, 9, 11, 7, 19],   // -X back
    [6, 18, 19, 7, 15],  // -X bottom
  ];

  const faces: PolyhedronFace[] = faceSets.map((set, i) => {
    // Re-order this set clockwise as seen from outside.
    const points = set.map(idx => vertices[idx]!);
    const center = Vec3.centroid(points);
    const outward = Vec3.normalize(center);
    // Build a 2D basis in the face plane.
    let u: Vec3T;
    if (Math.abs(outward[0]) < 0.9) u = Vec3.normalize(Vec3.cross(outward, [1, 0, 0]));
    else u = Vec3.normalize(Vec3.cross(outward, [0, 1, 0]));
    const w = Vec3.cross(outward, u);
    // Sort by angle in the face plane (CCW from outside view), then reverse for CW from outside.
    const withAngle = set.map(idx => {
      const d = Vec3.sub(vertices[idx]!, center);
      const x = Vec3.dot(d, u);
      const y = Vec3.dot(d, w);
      return { idx, angle: Math.atan2(y, x) };
    });
    withAngle.sort((a, b) => a.angle - b.angle);
    const ccw = withAngle.map(x => x.idx);
    const cw = ccw.slice().reverse();
    return { vertexIndices: cw, upHint: [0, 1, 0] as const, id: `pent-${i}` };
  });

  return { vertices, faces };
}
