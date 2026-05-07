import { Vec3 } from '../core/math/vec3';
import type { Vec3 as Vec3T } from '../core/math/vec3';
import { Quat } from '../core/math/quat';
import type { Quat as QuatT } from '../core/math/quat';
import { faceNormal, faceCentroid } from './polyhedron';
import type { Polyhedron } from './polyhedron';

/**
 * The "view normal" we want every active face to take in world coordinates:
 * pointing toward the camera (+Z in our convention) so that the face is
 * fully visible, with up = +Y on screen.
 */
export const VIEW_FACE_NORMAL: Vec3T = [0, 0, 1];
export const VIEW_UP: Vec3T = [0, 1, 0];

export interface CanonicalOrientation {
  /** Rotation R such that R(faceNormal) = +Z and R(upHint) projected on screen is +Y. */
  rotation: QuatT;
  /** The face's up-vector in object space (after disambiguation). */
  upObject: Vec3T;
  /** Number of discrete roll positions = number of edges. */
  rollSteps: number;
}

/**
 * For a given face, pick a canonical "up" direction in object space:
 * - if upHint is provided and not parallel to the normal, use it (after projection onto the face plane);
 * - otherwise pick the centroid → first-vertex direction projected on the face plane.
 */
export function pickFaceUp(p: Polyhedron, faceIndex: number): Vec3T {
  const f = p.faces[faceIndex]!;
  const n = faceNormal(p, faceIndex);
  let candidate: Vec3T | null = null;
  if (f.upHint) {
    const proj = Vec3.sub(f.upHint, Vec3.scale(n, Vec3.dot(f.upHint, n)));
    if (Vec3.length(proj) > 1e-6) candidate = Vec3.normalize(proj);
  }
  if (!candidate) {
    const c = faceCentroid(p, faceIndex);
    const v0 = p.vertices[f.vertexIndices[0]!]!;
    const dir = Vec3.sub(v0, c);
    const proj = Vec3.sub(dir, Vec3.scale(n, Vec3.dot(dir, n)));
    candidate = Vec3.length(proj) > 1e-6 ? Vec3.normalize(proj) : ([1, 0, 0] as Vec3T);
  }
  return candidate;
}

/**
 * Build the canonical orientation rotation that brings face f to view.
 * Two-step rotation: align normal with +Z, then roll around +Z so that
 * the projected upObject lands on +Y.
 */
export function canonicalOrientation(p: Polyhedron, faceIndex: number): CanonicalOrientation {
  const n = faceNormal(p, faceIndex);
  const up = pickFaceUp(p, faceIndex);

  // Step 1: rotation that maps n onto +Z.
  const r1 = Quat.fromUnitVectors(n, VIEW_FACE_NORMAL);

  // Step 2: roll around +Z so that r1(up) lands on +Y.
  const upRot = Quat.rotate(r1, up);
  // Project on XY plane (z-component is ~0 in theory, but be safe):
  const ux = upRot[0];
  const uy = upRot[1];
  const angle = Math.atan2(ux, uy); // angle from +Y, going around +Z (right-handed)
  // We want to rotate by -angle around +Z to land on +Y.
  const r2 = Quat.fromAxisAngle([0, 0, 1], -angle);

  const rotation = Quat.normalize(Quat.multiply(r2, r1));
  const rollSteps = p.faces[faceIndex]!.vertexIndices.length;

  return { rotation, upObject: up, rollSteps };
}

/**
 * Build a rotation that, applied after the canonical orientation, rolls the
 * visible face by k discrete steps (k * 2π / rollSteps) clockwise.
 */
export function rollRotation(rollSteps: number, k: number): QuatT {
  const angle = (k * 2 * Math.PI) / rollSteps;
  return Quat.fromAxisAngle([0, 0, 1], angle);
}
