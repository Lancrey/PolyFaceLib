import { Vec3 } from '../core/math/vec3';
import type { Vec3 as Vec3T } from '../core/math/vec3';

export interface PolyhedronFace {
  /** Indices of the polygon's vertices in the parent `Polyhedron.vertices` array. Must list vertices in order, viewed from outside (clockwise). */
  vertexIndices: readonly number[];
  /** Optional canonical "up" direction (in object space) when this face is brought to the camera. */
  upHint?: Vec3T;
  /** Optional user-supplied identifier (defaults to face index). */
  id?: string;
}

export interface Polyhedron {
  vertices: readonly Vec3T[];
  faces: readonly PolyhedronFace[];
}

export interface ValidationOptions {
  /** Accept faces whose vertices deviate from a perfect plane by at most this distance. */
  planarityTolerance?: number;
  /** Reject convexity violations rather than warn. */
  strictConvex?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a polyhedron: closed manifold (every edge shared by exactly two
 * faces), planar faces, convexity (every vertex on the inner side of every
 * face's plane).
 */
export function validatePolyhedron(p: Polyhedron, opts: ValidationOptions = {}): ValidationResult {
  const planarTol = opts.planarityTolerance ?? 1e-4;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (p.vertices.length < 4) {
    errors.push(`Polyhedron must have at least 4 vertices (got ${p.vertices.length}).`);
  }
  if (p.faces.length < 4) {
    errors.push(`Polyhedron must have at least 4 faces (got ${p.faces.length}).`);
  }

  const V = p.vertices.length;
  const E = new Map<string, number>();

  for (let i = 0; i < p.faces.length; i++) {
    const f = p.faces[i]!;
    if (f.vertexIndices.length < 3) {
      errors.push(`Face ${i}: needs >= 3 vertices, got ${f.vertexIndices.length}.`);
      continue;
    }
    for (const idx of f.vertexIndices) {
      if (idx < 0 || idx >= V) {
        errors.push(`Face ${i}: vertex index ${idx} out of range [0, ${V - 1}].`);
      }
    }
    const n = f.vertexIndices.length;
    for (let k = 0; k < n; k++) {
      const a = f.vertexIndices[k]!;
      const b = f.vertexIndices[(k + 1) % n]!;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      E.set(key, (E.get(key) ?? 0) + 1);
    }
  }

  for (const [key, count] of E) {
    if (count !== 2) {
      errors.push(`Edge ${key}: shared by ${count} face(s), expected 2 (closed manifold).`);
    }
  }

  // Euler's formula: V - E + F = 2 for a convex polyhedron homeomorphic to a sphere.
  if (errors.length === 0) {
    const Ec = E.size;
    const F = p.faces.length;
    const euler = V - Ec + F;
    if (euler !== 2) {
      warnings.push(`Euler characteristic V - E + F = ${euler} (expected 2 for convex closed polyhedron).`);
    }
  }

  // Planarity & convexity per face.
  for (let i = 0; i < p.faces.length; i++) {
    const f = p.faces[i]!;
    if (f.vertexIndices.length < 3) continue;
    const a = p.vertices[f.vertexIndices[0]!]!;
    const b = p.vertices[f.vertexIndices[1]!]!;
    const c = p.vertices[f.vertexIndices[2]!]!;
    const ab = Vec3.sub(b, a);
    const ac = Vec3.sub(c, a);
    const normal = Vec3.normalize(Vec3.cross(ab, ac));

    // Planarity: all face vertices satisfy normal . (v - a) ~ 0
    for (let k = 3; k < f.vertexIndices.length; k++) {
      const v = p.vertices[f.vertexIndices[k]!]!;
      const d = Math.abs(Vec3.dot(normal, Vec3.sub(v, a)));
      if (d > planarTol) {
        warnings.push(`Face ${i}: vertex ${f.vertexIndices[k]} deviates ${d.toExponential(2)} from face plane.`);
      }
    }

    // Convexity: every other vertex of the polyhedron should be on the same side of the plane.
    // The inner side is where the centroid of the polyhedron sits.
    // We accept tolerance equal to planarTol.
    const polyCentroid = Vec3.centroid(p.vertices);
    const inwardSide = Math.sign(Vec3.dot(normal, Vec3.sub(polyCentroid, a)));
    if (inwardSide === 0) {
      warnings.push(`Face ${i}: centroid lies on the face plane (degenerate).`);
      continue;
    }
    for (let v = 0; v < V; v++) {
      if (f.vertexIndices.includes(v)) continue;
      const side = Math.sign(Vec3.dot(normal, Vec3.sub(p.vertices[v]!, a)));
      if (side !== 0 && side !== inwardSide) {
        const msg = `Face ${i}: vertex ${v} on outer side — polyhedron not convex.`;
        if (opts.strictConvex) errors.push(msg);
        else warnings.push(msg);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function faceNormal(p: Polyhedron, faceIndex: number): Vec3T {
  const f = p.faces[faceIndex]!;
  const a = p.vertices[f.vertexIndices[0]!]!;
  const b = p.vertices[f.vertexIndices[1]!]!;
  const c = p.vertices[f.vertexIndices[2]!]!;
  // Vertices are clockwise viewed from outside, so cross(b-a, c-a) points inward.
  // Negate so that normal points outward.
  const n = Vec3.cross(Vec3.sub(b, a), Vec3.sub(c, a));
  const polyCentroid = Vec3.centroid(p.vertices);
  // Adjust orientation so that normal points away from the centroid.
  const center = Vec3.centroid(f.vertexIndices.map(i => p.vertices[i]!));
  const outward = Vec3.sub(center, polyCentroid);
  if (Vec3.dot(n, outward) < 0) return Vec3.normalize(Vec3.neg(n));
  return Vec3.normalize(n);
}

export function faceCentroid(p: Polyhedron, faceIndex: number): Vec3T {
  const f = p.faces[faceIndex]!;
  return Vec3.centroid(f.vertexIndices.map(i => p.vertices[i]!));
}
