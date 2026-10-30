/**
 * Immutable 3D vector helpers (tuple-based to keep allocations cheap and the
 * value type structurally simple — enables literal `[x, y, z]` interop).
 */
export type Vec3 = readonly [number, number, number];

const EPS = 1e-9;

export const Vec3 = {
  zero(): Vec3 {
    return [0, 0, 0];
  },
  of(x: number, y: number, z: number): Vec3 {
    return [x, y, z];
  },
  add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  },
  sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },
  scale(a: Vec3, s: number): Vec3 {
    return [a[0] * s, a[1] * s, a[2] * s];
  },
  neg(a: Vec3): Vec3 {
    return [-a[0], -a[1], -a[2]];
  },
  dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },
  cross(a: Vec3, b: Vec3): Vec3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  },
  length(a: Vec3): number {
    return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  },
  lengthSq(a: Vec3): number {
    return a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
  },
  distance(a: Vec3, b: Vec3): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },
  normalize(a: Vec3): Vec3 {
    const len = Vec3.length(a);
    if (len < EPS) return [0, 0, 0];
    return [a[0] / len, a[1] / len, a[2] / len];
  },
  lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  },
  equals(a: Vec3, b: Vec3, eps = EPS): boolean {
    return (
      Math.abs(a[0] - b[0]) <= eps &&
      Math.abs(a[1] - b[1]) <= eps &&
      Math.abs(a[2] - b[2]) <= eps
    );
  },
  centroid(points: readonly Vec3[]): Vec3 {
    if (points.length === 0) return [0, 0, 0];
    let x = 0;
    let y = 0;
    let z = 0;
    for (const p of points) {
      x += p[0];
      y += p[1];
      z += p[2];
    }
    const n = points.length;
    return [x / n, y / n, z / n];
  },
  /** Angle in radians between a and b, clamped against fp drift. */
  angle(a: Vec3, b: Vec3): number {
    const la = Vec3.length(a);
    const lb = Vec3.length(b);
    if (la < EPS || lb < EPS) return 0;
    const c = Vec3.dot(a, b) / (la * lb);
    return Math.acos(Math.max(-1, Math.min(1, c)));
  },
};

export const VEC3_EPS = EPS;
