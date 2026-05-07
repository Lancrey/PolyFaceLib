import type { Vec3 } from './vec3';
import type { Vec4 } from './vec4';

/**
 * 4x4 matrix in column-major order (CSS `matrix3d()` layout).
 * Indices: m[col * 4 + row]
 *  m0 m4 m8  m12
 *  m1 m5 m9  m13
 *  m2 m6 m10 m14
 *  m3 m7 m11 m15
 */
export type Mat4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export const Mat4 = {
  identity(): Mat4 {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  },

  translation(x: number, y: number, z: number): Mat4 {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  },

  scaling(sx: number, sy: number, sz: number): Mat4 {
    return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
  },

  /**
   * Multiply column-major matrices: result = a * b.
   * (Equivalent to: apply b first, then a.)
   */
  multiply(a: Mat4, b: Mat4): Mat4 {
    const r = new Array(16) as number[];
    for (let c = 0; c < 4; c++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += (a[k * 4 + row] as number) * (b[c * 4 + k] as number);
        }
        r[c * 4 + row] = sum;
      }
    }
    return r as unknown as Mat4;
  },

  /**
   * Compose left-to-right: composeChain([A, B, C]) === A * B * C
   * which means C is applied first, then B, then A.
   */
  composeChain(matrices: readonly Mat4[]): Mat4 {
    let result = Mat4.identity();
    for (const m of matrices) result = Mat4.multiply(result, m);
    return result;
  },

  /** Transform a Vec4 column by this matrix (m * v). */
  transformVec4(m: Mat4, v: Vec4): Vec4 {
    const x = v[0];
    const y = v[1];
    const z = v[2];
    const w = v[3];
    return [
      (m[0] as number) * x + (m[4] as number) * y + (m[8] as number) * z + (m[12] as number) * w,
      (m[1] as number) * x + (m[5] as number) * y + (m[9] as number) * z + (m[13] as number) * w,
      (m[2] as number) * x + (m[6] as number) * y + (m[10] as number) * z + (m[14] as number) * w,
      (m[3] as number) * x + (m[7] as number) * y + (m[11] as number) * z + (m[15] as number) * w,
    ];
  },

  /** Affine transform: treats v as (x, y, z, 1) and returns the (x, y, z) part. */
  transformPoint(m: Mat4, v: Vec3): Vec3 {
    const r = Mat4.transformVec4(m, [v[0], v[1], v[2], 1]);
    if (r[3] !== 0 && r[3] !== 1) {
      return [r[0] / r[3], r[1] / r[3], r[2] / r[3]];
    }
    return [r[0], r[1], r[2]];
  },

  /** Serialize to CSS `matrix3d(...)` argument string (column-major, 16 numbers). */
  toCSSMatrix3d(m: Mat4): string {
    return m.join(',');
  },

  /**
   * Build a quaternion-derived rotation matrix.
   * q = (x, y, z, w), unit quaternion expected.
   */
  fromQuat(q: readonly [number, number, number, number]): Mat4 {
    const x = q[0];
    const y = q[1];
    const z = q[2];
    const w = q[3];
    const xx = x * x;
    const yy = y * y;
    const zz = z * z;
    const xy = x * y;
    const xz = x * z;
    const yz = y * z;
    const wx = w * x;
    const wy = w * y;
    const wz = w * z;
    return [
      1 - 2 * (yy + zz), 2 * (xy + wz),     2 * (xz - wy),     0,
      2 * (xy - wz),     1 - 2 * (xx + zz), 2 * (yz + wx),     0,
      2 * (xz + wy),     2 * (yz - wx),     1 - 2 * (xx + yy), 0,
      0,                  0,                  0,                  1,
    ];
  },
};
