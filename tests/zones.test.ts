import { describe, it, expect } from 'vitest';
import { buildFaceZones, hitTestZones, pickEdgeByAngle } from '../src/input/zones';
import type { FaceModel } from '../src/core/projector';
import { Mat4 } from '../src/core/math/mat4';

function squareFaceModel(size: number): FaceModel {
  const h = size / 2;
  return {
    model: Mat4.identity(),
    width: size,
    height: size,
    polygon2D: [[-h, -h], [h, -h], [h, h], [-h, h]],
    inscribedRect: { x: -h, y: -h, w: size, h: size },
  };
}

function triangleFaceModel(size: number): FaceModel {
  // Equilateral triangle centered at origin.
  const r = size / 2;
  return {
    model: Mat4.identity(),
    width: 2 * r,
    height: r * Math.sqrt(3),
    polygon2D: [[0, -r * Math.sqrt(3) / 2], [r, r * Math.sqrt(3) / 4], [-r, r * Math.sqrt(3) / 4]],
    inscribedRect: { x: -r / 2, y: -r / 4, w: r, h: r / 2 },
  };
}

describe('FaceZones', () => {
  it('square: 4 edge zones, dead zone in center', () => {
    const m = squareFaceModel(100);
    const z = buildFaceZones(m, 0.5);
    expect(z.edgeZones.length).toBe(4);
    expect(hitTestZones(z, 0, 0)).toBe(-1); // dead zone
    expect(hitTestZones(z, 0, 45)).toBeGreaterThanOrEqual(0); // some edge zone
  });

  it('triangle: 3 edge zones', () => {
    const m = triangleFaceModel(100);
    const z = buildFaceZones(m, 0.4);
    expect(z.edgeZones.length).toBe(3);
  });

  it('pickEdgeByAngle picks closest', () => {
    const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    expect(pickEdgeByAngle(angles, 0.1)).toBe(0);
    expect(pickEdgeByAngle(angles, Math.PI / 2 + 0.1)).toBe(1);
    expect(pickEdgeByAngle(angles, -Math.PI / 2 - 0.1)).toBe(3);
  });
});
