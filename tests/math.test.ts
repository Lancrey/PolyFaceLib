import { describe, it, expect } from 'vitest';
import { Vec3 } from '../src/core/math/vec3';
import { Mat4 } from '../src/core/math/mat4';
import { Quat } from '../src/core/math/quat';

describe('Vec3', () => {
  it('basic ops', () => {
    expect(Vec3.add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(Vec3.sub([1, 2, 3], [4, 5, 6])).toEqual([-3, -3, -3]);
    expect(Vec3.scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
    expect(Vec3.dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(Vec3.cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(Vec3.length([3, 4, 0])).toBe(5);
  });

  it('normalize', () => {
    expect(Vec3.length(Vec3.normalize([5, 0, 0]))).toBeCloseTo(1);
    expect(Vec3.normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('centroid', () => {
    expect(Vec3.centroid([[0, 0, 0], [2, 0, 0], [0, 2, 0]])).toEqual([2 / 3, 2 / 3, 0]);
  });
});

describe('Mat4', () => {
  it('identity * identity = identity', () => {
    const I = Mat4.identity();
    const m = Mat4.multiply(I, I);
    expect(m).toEqual(I);
  });

  it('translation transforms point', () => {
    const t = Mat4.translation(1, 2, 3);
    const p = Mat4.transformPoint(t, [10, 20, 30]);
    expect(p).toEqual([11, 22, 33]);
  });

  it('scaling', () => {
    const s = Mat4.scaling(2, 3, 4);
    expect(Mat4.transformPoint(s, [1, 1, 1])).toEqual([2, 3, 4]);
  });

  it('CSS serialization', () => {
    const I = Mat4.identity();
    const css = Mat4.toCSSMatrix3d(I);
    expect(css).toBe('1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1');
  });

  it('quaternion-derived rotation matches axis-angle', () => {
    // 90° around Y
    const q = Quat.fromAxisAngle([0, 1, 0], Math.PI / 2);
    const m = Mat4.fromQuat(q);
    const p = Mat4.transformPoint(m, [1, 0, 0]);
    expect(p[0]).toBeCloseTo(0);
    expect(p[1]).toBeCloseTo(0);
    expect(p[2]).toBeCloseTo(-1);
  });
});

describe('Quat', () => {
  it('identity', () => {
    expect(Quat.identity()).toEqual([0, 0, 0, 1]);
  });

  it('axis-angle rotates a vector', () => {
    const q = Quat.fromAxisAngle([0, 0, 1], Math.PI / 2);
    const r = Quat.rotate(q, [1, 0, 0]);
    expect(r[0]).toBeCloseTo(0);
    expect(r[1]).toBeCloseTo(1);
    expect(r[2]).toBeCloseTo(0);
  });

  it('multiplication is non-commutative and combines', () => {
    const a = Quat.fromAxisAngle([1, 0, 0], Math.PI / 2);
    const b = Quat.fromAxisAngle([0, 1, 0], Math.PI / 2);
    const ab = Quat.multiply(a, b);
    const ba = Quat.multiply(b, a);
    expect(Quat.dot(ab, ba)).not.toBeCloseTo(1);
    // Apply ab and the equivalent: rotate by b then a.
    const v: [number, number, number] = [0, 0, 1];
    const r1 = Quat.rotate(ab, v);
    const r2 = Quat.rotate(a, Quat.rotate(b, v));
    expect(r1[0]).toBeCloseTo(r2[0]);
    expect(r1[1]).toBeCloseTo(r2[1]);
    expect(r1[2]).toBeCloseTo(r2[2]);
  });

  it('slerp endpoints', () => {
    const a = Quat.identity();
    const b = Quat.fromAxisAngle([0, 0, 1], Math.PI);
    const r0 = Quat.slerp(a, b, 0);
    const r1 = Quat.slerp(a, b, 1);
    expect(Quat.sameRotation(r0, a)).toBe(true);
    expect(Quat.sameRotation(r1, b)).toBe(true);
  });

  it('fromUnitVectors aligns', () => {
    const q = Quat.fromUnitVectors([1, 0, 0], [0, 1, 0]);
    const r = Quat.rotate(q, [1, 0, 0]);
    expect(r[0]).toBeCloseTo(0);
    expect(r[1]).toBeCloseTo(1);
    expect(r[2]).toBeCloseTo(0);
  });

  it('fromUnitVectors handles antiparallel input', () => {
    const q = Quat.fromUnitVectors([1, 0, 0], [-1, 0, 0]);
    const r = Quat.rotate(q, [1, 0, 0]);
    expect(r[0]).toBeCloseTo(-1);
    expect(r[1]).toBeCloseTo(0);
    expect(r[2]).toBeCloseTo(0);
  });
});
