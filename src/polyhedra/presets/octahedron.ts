import type { Polyhedron } from '../polyhedron';

/**
 * Regular octahedron with vertices on the coordinate axes (±X, ±Y, ±Z).
 */
export function octahedron(): Polyhedron {
  const v = [
    [ 1,  0,  0], // 0 +X
    [-1,  0,  0], // 1 -X
    [ 0,  1,  0], // 2 +Y
    [ 0, -1,  0], // 3 -Y
    [ 0,  0,  1], // 4 +Z
    [ 0,  0, -1], // 5 -Z
  ] as const;

  const faces = [
    { vertexIndices: [0, 2, 4], upHint: [0, 1, 0] as const, id: 'pxpy_pz' },
    { vertexIndices: [2, 1, 4], upHint: [0, 1, 0] as const, id: 'mxpy_pz' },
    { vertexIndices: [1, 3, 4], upHint: [0, -1, 0] as const, id: 'mxmy_pz' },
    { vertexIndices: [3, 0, 4], upHint: [0, -1, 0] as const, id: 'pxmy_pz' },
    { vertexIndices: [2, 0, 5], upHint: [0, 1, 0] as const, id: 'pxpy_mz' },
    { vertexIndices: [1, 2, 5], upHint: [0, 1, 0] as const, id: 'mxpy_mz' },
    { vertexIndices: [3, 1, 5], upHint: [0, -1, 0] as const, id: 'mxmy_mz' },
    { vertexIndices: [0, 3, 5], upHint: [0, -1, 0] as const, id: 'pxmy_mz' },
  ];

  return {
    vertices: v.map(p => [p[0], p[1], p[2]] as const),
    faces,
  };
}
