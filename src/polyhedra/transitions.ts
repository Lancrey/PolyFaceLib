import { Vec3 } from '../core/math/vec3';
import { Quat } from '../core/math/quat';
import type { Quat as QuatT } from '../core/math/quat';
import { canonicalOrientation, rollRotation } from './orientations';
import type { CanonicalOrientation } from './orientations';
import { buildAdjacency } from './adjacency';
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
 * Algorithm — for every (face, roll, visibleEdge):
 * 1. The "current" world rotation is canonical(face) ∘ rollK (k = roll).
 * 2. The user crosses edge `visibleEdge` (in the rolled visible frame). We map
 *    it back to an actual face edge: `faceEdge = (visibleEdge - roll) mod N`.
 * 3. The adjacent face across that edge becomes the new face, and we always
 *    arrive at it in its canonical orientation (roll = 0). That guarantees
 *    the destination face's upHint lands on screen-up so the content reads
 *    upright after every navigation. Direction-based navigation
 *    (`navigate('right')`, swipes, …) stays consistent because each face's
 *    canonical orientation is fixed.
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
    // Always land in the destination face's canonical orientation. Any other
    // roll would tilt the destination face's content (90°, 180°, 270°) and
    // break readability of text/images on the active face.
    const toRoll = 0;
    const targetRotation = orientationOf(toFace, toRoll);
    return { toFace, toRoll, targetRotation };
  }

  return { get, orientationOf };
}

/**
 * Compute the visible edge angles in screen-space CSS coordinates (Y down):
 * 0 = +X (right), π/2 = down, -π/2 = up, π/-π = left. Matches
 * `edgeForDirection`'s convention so that `navigate('up')` actually picks the
 * top edge, etc.
 */
export function visibleEdgeAngles(
  p: Polyhedron,
  face: number,
  roll: number,
): readonly number[] {
  const co = canonicalOrientation(p, face);
  const rollQ = rollRotation(co.rollSteps, roll);
  const orient = Quat.multiply(rollQ, co.rotation);
  const f = p.faces[face]!;
  const center = Vec3.centroid(f.vertexIndices.map(i => p.vertices[i]!));
  const N = f.vertexIndices.length;
  const out: number[] = new Array(N);
  // Visible index `visible` corresponds to face edge (visible - roll) mod N.
  for (let visible = 0; visible < N; visible++) {
    const faceEdge = ((visible - roll) % N + N) % N;
    const a = p.vertices[f.vertexIndices[faceEdge]!]!;
    const b = p.vertices[f.vertexIndices[(faceEdge + 1) % N]!]!;
    const mid = Vec3.scale(Vec3.add(a, b), 0.5);
    const local = Vec3.sub(mid, center);
    const screen = Quat.rotate(orient, local);
    // Flip world +Y → CSS -Y so the angle convention matches the rest of the
    // input pipeline (polygon2D, pointer.localCoords, edgeForDirection).
    out[visible] = Math.atan2(-screen[1], screen[0]);
  }
  return out;
}
