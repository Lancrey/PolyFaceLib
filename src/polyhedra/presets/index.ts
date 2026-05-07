export { cube } from './cube';
export { tetrahedron } from './tetrahedron';
export { octahedron } from './octahedron';
export { dodecahedron } from './dodecahedron';
export { icosahedron } from './icosahedron';
export { prism } from './prism';
export type { PrismOptions } from './prism';

import { cube } from './cube';
import { tetrahedron } from './tetrahedron';
import { octahedron } from './octahedron';
import { dodecahedron } from './dodecahedron';
import { icosahedron } from './icosahedron';
import { prism } from './prism';

/**
 * Aggregated factory namespace for tree-shake-friendly imports.
 * Use the named exports above when you only need one preset.
 */
export const Polyhedra = {
  cube,
  tetrahedron,
  octahedron,
  dodecahedron,
  icosahedron,
  prism,
};
