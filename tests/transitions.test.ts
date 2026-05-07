import { describe, it, expect } from 'vitest';
import { cube, tetrahedron, octahedron, dodecahedron, icosahedron } from '../src/polyhedra/presets';
import { buildTransitionTable } from '../src/polyhedra/transitions';
import { Quat } from '../src/core/math/quat';
import type { Polyhedron } from '../src/polyhedra/polyhedron';

function buildAndStep(p: Polyhedron) {
  const t = buildTransitionTable(p);
  return t;
}

describe('Transition solver', () => {
  it.each([
    { name: 'cube', build: cube },
    { name: 'tetrahedron', build: tetrahedron },
    { name: 'octahedron', build: octahedron },
    { name: 'dodecahedron', build: dodecahedron },
    { name: 'icosahedron', build: icosahedron },
  ])('$name: produces a result for every (face, roll, edge)', ({ build }) => {
    const p = build();
    const t = buildAndStep(p);
    for (let f = 0; f < p.faces.length; f++) {
      const N = p.faces[f]!.vertexIndices.length;
      for (let r = 0; r < N; r++) {
        for (let e = 0; e < N; e++) {
          const res = t.get(f, r, e);
          expect(res.toFace).toBeGreaterThanOrEqual(0);
          expect(res.toFace).toBeLessThan(p.faces.length);
          expect(res.toFace).not.toBe(f); // navigating across an edge always lands on a different face
          // Returned quaternion is unit-norm.
          const len = Math.hypot(res.targetRotation[0], res.targetRotation[1], res.targetRotation[2], res.targetRotation[3]);
          expect(len).toBeCloseTo(1, 4);
        }
      }
    }
  });

  it.each([
    { name: 'cube', build: cube },
    { name: 'tetrahedron', build: tetrahedron },
    { name: 'octahedron', build: octahedron },
    { name: 'dodecahedron', build: dodecahedron },
    { name: 'icosahedron', build: icosahedron },
  ])('$name: every transition lands at roll = 0 (active face is upright)', ({ build }) => {
    const p = build();
    const t = buildTransitionTable(p);
    for (let f = 0; f < p.faces.length; f++) {
      const N = p.faces[f]!.vertexIndices.length;
      for (let r = 0; r < N; r++) {
        for (let v = 0; v < N; v++) {
          expect(t.get(f, r, v).toRoll).toBe(0);
        }
      }
    }
  });

  it.each([
    { name: 'cube', build: cube },
    { name: 'tetrahedron', build: tetrahedron },
    { name: 'octahedron', build: octahedron },
    { name: 'dodecahedron', build: dodecahedron },
    { name: 'icosahedron', build: icosahedron },
  ])('$name: round-trips back home in 1 step via the shared edge', ({ build }) => {
    // From face A roll 0 cross visible edge v → face B roll 0. The shared
    // edge sits at face-edge index `eB` on B; with roll 0 that's also its
    // visible index. Crossing visible edge `eB` from B must return to A.
    const p = build();
    const t = buildTransitionTable(p);
    for (let f = 0; f < p.faces.length; f++) {
      const N = p.faces[f]!.vertexIndices.length;
      for (let v = 0; v < N; v++) {
        const fwd = t.get(f, 0, v);
        const sharedFaceEdgeOnB =
          p.faces[fwd.toFace]!.vertexIndices
            .map((_, k) => k)
            .find(k => {
              const a = p.faces[fwd.toFace]!.vertexIndices[k]!;
              const b = p.faces[fwd.toFace]!.vertexIndices[(k + 1) % p.faces[fwd.toFace]!.vertexIndices.length]!;
              const sourceA = p.faces[f]!.vertexIndices[v]!;
              const sourceB = p.faces[f]!.vertexIndices[(v + 1) % N]!;
              return (a === sourceA && b === sourceB) || (a === sourceB && b === sourceA);
            })!;
        const back = t.get(fwd.toFace, fwd.toRoll, sharedFaceEdgeOnB);
        expect(back.toFace).toBe(f);
        expect(back.toRoll).toBe(0);
      }
    }
  });

  it('orientationOf and transition target are aligned (round-trip via inverse navigation)', () => {
    const p = cube();
    const t = buildTransitionTable(p);
    const start = t.orientationOf(0, 0);
    const next = t.get(0, 0, 0);
    // The destination's roll/face should yield the same quaternion as t.orientationOf(toFace, toRoll).
    const recomputed = t.orientationOf(next.toFace, next.toRoll);
    expect(Quat.sameRotation(recomputed, next.targetRotation)).toBe(true);
    void start;
  });
});
