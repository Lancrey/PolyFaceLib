import { Vec3 } from './vec3';

/** Unit quaternion (x, y, z, w). */
export type Quat = readonly [number, number, number, number];

const EPS = 1e-9;

export const Quat = {
  identity(): Quat {
    return [0, 0, 0, 1];
  },

  of(x: number, y: number, z: number, w: number): Quat {
    return [x, y, z, w];
  },

  fromAxisAngle(axisIn: Vec3, angle: number): Quat {
    const axis = Vec3.normalize(axisIn);
    const half = angle * 0.5;
    const s = Math.sin(half);
    return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
  },

  /**
   * Build a quaternion that rotates `from` (a unit vector) onto `to` (a unit vector).
   */
  fromUnitVectors(fromIn: Vec3, toIn: Vec3): Quat {
    const from = Vec3.normalize(fromIn);
    const to = Vec3.normalize(toIn);
    let r = Vec3.dot(from, to) + 1;
    if (r < EPS) {
      r = 0;
      // Pick an orthogonal axis.
      if (Math.abs(from[0]) > Math.abs(from[2])) {
        return Quat.normalize([-from[1], from[0], 0, r]);
      }
      return Quat.normalize([0, -from[2], from[1], r]);
    }
    const c = Vec3.cross(from, to);
    return Quat.normalize([c[0], c[1], c[2], r]);
  },

  multiply(a: Quat, b: Quat): Quat {
    const ax = a[0];
    const ay = a[1];
    const az = a[2];
    const aw = a[3];
    const bx = b[0];
    const by = b[1];
    const bz = b[2];
    const bw = b[3];
    return [
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
      aw * bw - ax * bx - ay * by - az * bz,
    ];
  },

  conjugate(q: Quat): Quat {
    return [-q[0], -q[1], -q[2], q[3]];
  },

  inverse(q: Quat): Quat {
    const n = Quat.lengthSq(q);
    if (n < EPS) return Quat.identity();
    return [-q[0] / n, -q[1] / n, -q[2] / n, q[3] / n];
  },

  length(q: Quat): number {
    return Math.sqrt(Quat.lengthSq(q));
  },

  lengthSq(q: Quat): number {
    return q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
  },

  normalize(q: Quat): Quat {
    const len = Quat.length(q);
    if (len < EPS) return Quat.identity();
    return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
  },

  dot(a: Quat, b: Quat): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  },

  /** Spherical linear interpolation between two unit quaternions. */
  slerp(a: Quat, b: Quat, t: number): Quat {
    let bx = b[0];
    let by = b[1];
    let bz = b[2];
    let bw = b[3];
    let cosTheta = Quat.dot(a, b);
    if (cosTheta < 0) {
      cosTheta = -cosTheta;
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
    }
    if (cosTheta > 1 - 1e-7) {
      // nearly identical → linear interpolation, then renormalize
      return Quat.normalize([
        a[0] + (bx - a[0]) * t,
        a[1] + (by - a[1]) * t,
        a[2] + (bz - a[2]) * t,
        a[3] + (bw - a[3]) * t,
      ]);
    }
    const theta = Math.acos(cosTheta);
    const sinTheta = Math.sin(theta);
    const s0 = Math.sin((1 - t) * theta) / sinTheta;
    const s1 = Math.sin(t * theta) / sinTheta;
    return [
      a[0] * s0 + bx * s1,
      a[1] * s0 + by * s1,
      a[2] * s0 + bz * s1,
      a[3] * s0 + bw * s1,
    ];
  },

  /** Rotate v by q. */
  rotate(q: Quat, v: Vec3): Vec3 {
    // p' = q * (v, 0) * q^-1, expressed via the optimized formula:
    // t = 2 * cross(q.xyz, v); v' = v + q.w * t + cross(q.xyz, t)
    const qx = q[0];
    const qy = q[1];
    const qz = q[2];
    const qw = q[3];
    const tx = 2 * (qy * v[2] - qz * v[1]);
    const ty = 2 * (qz * v[0] - qx * v[2]);
    const tz = 2 * (qx * v[1] - qy * v[0]);
    return [
      v[0] + qw * tx + (qy * tz - qz * ty),
      v[1] + qw * ty + (qz * tx - qx * tz),
      v[2] + qw * tz + (qx * ty - qy * tx),
    ];
  },

  /** Whether two quaternions express (approximately) the same rotation. */
  sameRotation(a: Quat, b: Quat, eps = 1e-6): boolean {
    return Math.abs(Math.abs(Quat.dot(a, b)) - 1) <= eps;
  },
};
