import type { Polyhedron } from '../polyhedron';

/**
 * Unit cube centered at origin, edge length = 2 (vertices at ±1).
 * Faces ordered as: +X, -X, +Y, -Y, +Z, -Z.
 * Each face's vertices are listed clockwise when viewed from outside.
 */
export function cube(): Polyhedron {
  const v = [
    [-1, -1, -1], //0
    [ 1, -1, -1], //1
    [ 1,  1, -1], //2
    [-1,  1, -1], //3
    [-1, -1,  1], //4
    [ 1, -1,  1], //5
    [ 1,  1,  1], //6
    [-1,  1,  1], //7
  ] as const;

  const faces = [
    // +Z (front)
    { vertexIndices: [4, 5, 6, 7], upHint: [0, 1, 0] as const, id: 'front' },
    // -Z (back)
    { vertexIndices: [1, 0, 3, 2], upHint: [0, 1, 0] as const, id: 'back' },
    // +X (right)
    { vertexIndices: [5, 1, 2, 6], upHint: [0, 1, 0] as const, id: 'right' },
    // -X (left)
    { vertexIndices: [0, 4, 7, 3], upHint: [0, 1, 0] as const, id: 'left' },
    // +Y (top)
    { vertexIndices: [7, 6, 2, 3], upHint: [0, 0, -1] as const, id: 'top' },
    // -Y (bottom)
    { vertexIndices: [0, 1, 5, 4], upHint: [0, 0, 1] as const, id: 'bottom' },
  ];

  return {
    vertices: v.map(p => [p[0], p[1], p[2]] as const),
    faces,
  };
}
