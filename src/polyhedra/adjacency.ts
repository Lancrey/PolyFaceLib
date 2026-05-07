import type { Polyhedron } from './polyhedron';

export interface FaceEdge {
  /** Index of this edge within the face (0..N-1, in face's vertex order). */
  edgeIndex: number;
  /** Vertex indices of the edge's endpoints, in face's traversal order. */
  vertexA: number;
  vertexB: number;
  /** Index of the face on the other side of this edge. */
  adjacentFaceIndex: number;
  /** Within that adjacent face, the index of the same edge. */
  adjacentEdgeIndex: number;
}

export interface FaceAdjacency {
  faceIndex: number;
  edges: readonly FaceEdge[];
}

/**
 * Build the full face / edge / face adjacency graph from a validated polyhedron.
 * Throws if any edge is shared by != 2 faces.
 */
export function buildAdjacency(p: Polyhedron): readonly FaceAdjacency[] {
  // First pass: register every (sorted-pair) edge with the face/edge that owns it.
  const edgeMap = new Map<string, { face: number; edge: number; a: number; b: number }[]>();
  for (let fi = 0; fi < p.faces.length; fi++) {
    const f = p.faces[fi]!;
    const n = f.vertexIndices.length;
    for (let ei = 0; ei < n; ei++) {
      const a = f.vertexIndices[ei]!;
      const b = f.vertexIndices[(ei + 1) % n]!;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      let bucket = edgeMap.get(key);
      if (!bucket) {
        bucket = [];
        edgeMap.set(key, bucket);
      }
      bucket.push({ face: fi, edge: ei, a, b });
    }
  }

  // Second pass: per-face edges with adjacency resolved.
  const out: FaceAdjacency[] = [];
  for (let fi = 0; fi < p.faces.length; fi++) {
    const f = p.faces[fi]!;
    const n = f.vertexIndices.length;
    const edges: FaceEdge[] = [];
    for (let ei = 0; ei < n; ei++) {
      const a = f.vertexIndices[ei]!;
      const b = f.vertexIndices[(ei + 1) % n]!;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      const bucket = edgeMap.get(key)!;
      if (bucket.length !== 2) {
        throw new Error(`Edge ${key} shared by ${bucket.length} face(s); polyhedron is not a closed manifold.`);
      }
      const other = bucket.find(e => !(e.face === fi && e.edge === ei));
      if (!other) throw new Error(`Edge ${key}: failed to find partner half-edge.`);
      edges.push({
        edgeIndex: ei,
        vertexA: a,
        vertexB: b,
        adjacentFaceIndex: other.face,
        adjacentEdgeIndex: other.edge,
      });
    }
    out.push({ faceIndex: fi, edges });
  }
  return out;
}
