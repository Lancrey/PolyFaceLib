import type { Polyhedron } from '../polyhedron';

/**
 * Regular tetrahedron inscribed in the unit cube (vertices at four alternating cube corners).
 */
export function tetrahedron(): Polyhedron {
  const v = [
    [ 1,  1,  1], // 0
    [ 1, -1, -1], // 1
    [-1,  1, -1], // 2
    [-1, -1,  1], // 3
  ] as const;

  const faces = [
    { vertexIndices: [0, 2, 1], upHint: [0, 1, 0] as const, id: 'face-0' },
    { vertexIndices: [0, 1, 3], upHint: [0, 1, 0] as const, id: 'face-1' },
    { vertexIndices: [0, 3, 2], upHint: [0, 1, 0] as const, id: 'face-2' },
    { vertexIndices: [1, 2, 3], upHint: [0, 1, 0] as const, id: 'face-3' },
  ];

  return {
    vertices: v.map(p => [p[0], p[1], p[2]] as const),
    faces,
  };
}
