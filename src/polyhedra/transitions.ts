import { Vec3 } from '../core/math/vec3';
import { Quat } from '../core/math/quat';
import type { Quat as QuatT } from '../core/math/quat';
import { canonicalOrientation, rollRotation } from './orientations';
import type { CanonicalOrientation } from './orientations';
import { buildAdjacency } from './adjacency';
import type { FaceAdjacency } from './adjacency';
import type { Polyhedron } from './polyhedron';

export interface TransitionKey {
  face: number;
  roll: number;
  edgeIndex: number; // edge index in the *visible* (rolled) face frame
}

export interface TransitionResult {
  /** Destination face index. */
  toFace: number;
  /** Destination roll (in steps, [0, rollSteps_to)). */
  toRoll: number;
  /** Quaternion that brings the polyhedron from the current oriented state to the destination oriented state. */
  targetRotation: QuatT;
}

export interface TransitionTable {
  /**
   * For face `f`, roll `r`, edge `e` (e indexed in visible-face-after-roll frame),
   * the resulting face/roll/quaternion.
   */
  get(face: number, roll: number, edgeIndex: number): TransitionResult;
  /**
   * Compute the absolute orientation quaternion for a given (face, roll) pair.
   */
  orientationOf(face: number, roll: number): QuatT;
}

/**
 * Build the full transition table for a polyhedron.
 *
 * Algorithm — for every (face, roll, edge):
 * 1. The "current" world rotation is canonical(face) ∘ rollK (k = roll).
 * 2. The clicked edge in the visible frame is at slot `edgeIndex`. We must
 *    map it back to an actual face edge: the face's edge `(edgeIndex - roll) mod N`
 *    (clockwise rolls shift visible edges).
 * 3. The adjacent face across that edge becomes the new face. Its canonical
 *    orientation places it in front; we then choose the destination roll so
 *    that the destination face's upHint stays as close as possible to the
 *    current screen-up — which guarantees a "readable" arrival.
 *
 * The "readable" choice for roll is: rotate the destination canonical
 * orientation by the smallest k that minimizes angular distance from the
 * current absolute rotation. This implementation picks roll = 0 (canonical) by
 * default and could be enhanced later, but for symmetric Platonic solids
 * roll=0 yields the upHint aligned with screen up by construction.
 */
export function buildTransitionTable(p: Polyhedron): TransitionTable {
  const adjacency = buildAdjacency(p);
  const canon: CanonicalOrientation[] = p.faces.map((_, i) => canonicalOrientation(p, i));

  // Pre-compute a memo of orientation(face, roll).
  const orientMemo = new Map<string, QuatT>();
  function orientationOf(face: number, roll: number): QuatT {
    const key = `${face}|${roll}`;
    let q = orientMemo.get(key);
    if (q) return q;
    const c = canon[face]!;
    q = Quat.normalize(Quat.multiply(rollRotation(c.rollSteps, roll), c.rotation));
    orientMemo.set(key, q);
    return q;
  }

  function visibleEdgeToFaceEdge(face: number, roll: number, visibleEdge: number): number {
    const N = canon[face]!.rollSteps;
    return ((visibleEdge - roll) % N + N) % N;
  }

  function get(face: number, roll: number, visibleEdge: number): TransitionResult {
    const adjFace = adjacency[face]!;
    const N = canon[face]!.rollSteps;
    if (visibleEdge < 0 || visibleEdge >= N) {
      throw new Error(`Edge index ${visibleEdge} out of range for face ${face} (N=${N}).`);
    }
    const faceEdge = visibleEdgeToFaceEdge(face, roll, visibleEdge);
    const edge = adjFace.edges[faceEdge]!;
    const toFace = edge.adjacentFaceIndex;

    // Find the destination roll that keeps the destination face's screen-up as close
    // as possible to the current screen-up.
    const currentOrientation = orientationOf(face, roll);
    // Screen-up in world coords for the current orientation is just (0, 1, 0)
    // because that's the screen-up axis (the rotation already aligns content).
    // We want, after the polyhedron rotates to the destination canonical, the
    // destination face's "upObject" to land closest to (0, 1, 0).
    const NTo = canon[toFace]!.rollSteps;
    let bestRoll = 0;
    let bestDist = Infinity;
    for (let k = 0; k < NTo; k++) {
      const candidate = orientationOf(toFace, k);
      // Compose: the current state is `currentOrientation`. The destination state is `candidate`.
      // The "navigation rotation" that goes from current to candidate is candidate * currentOrientation^-1.
      // We want the destination upHint (in object space) — already aligned with +Y when face is canonical
      // — to be as close to +Y as possible after the rotation. By construction it always is, so we instead
      // pick the rotation with the smallest angular distance from currentOrientation
      // (smoothest visual transition through the flip).
      const dot = Math.abs(Quat.dot(currentOrientation, candidate));
      const dist = 1 - dot;
      if (dist < bestDist) {
        bestDist = dist;
        bestRoll = k;
      }
    }
    const targetRotation = orientationOf(toFace, bestRoll);
    return { toFace, toRoll: bestRoll, targetRotation };
  }

  return { get, orientationOf };
}

/**
 * Compute the visible edge angles (in screen-space, radians, 0 = +X, going CCW)
 * for a face at a given roll. Useful for hit-testing and direction-based navigation.
 */
export function visibleEdgeAngles(
  p: Polyhedron,
  face: number,
  roll: number,
  adjacency: readonly FaceAdjacency[],
): readonly number[] {
  const co = canonicalOrientation(p, face);
  const rollQ = rollRotation(co.rollSteps, roll);
  const orient = Quat.multiply(rollQ, co.rotation);
  const f = p.faces[face]!;
  const center = Vec3.centroid(f.vertexIndices.map(i => p.vertices[i]!));
  const out: number[] = [];
  // Iterate edges in face traversal order, but the visible index is shifted by `roll`.
  const N = f.vertexIndices.length;
  const ordered: number[] = new Array(N);
  for (let visible = 0; visible < N; visible++) {
    const faceEdge = ((visible - roll) % N + N) % N;
    const a = p.vertices[f.vertexIndices[faceEdge]!]!;
    const b = p.vertices[f.vertexIndices[(faceEdge + 1) % N]!]!;
    const mid = Vec3.scale(Vec3.add(a, b), 0.5);
    const local = Vec3.sub(mid, center);
    const screen = Quat.rotate(orient, local);
    ordered[visible] = Math.atan2(screen[1], screen[0]);
  }
  for (let i = 0; i < N; i++) out.push(ordered[i]!);
  // referenced to silence "unused" lint
  void adjacency;
  return out;
}
