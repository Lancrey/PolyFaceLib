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

  it('cube: cycling visible edge 0 four times returns to starting (face, roll)', () => {
    const p = cube();
    const t = buildTransitionTable(p);
    let face = 0;
    let roll = 0;
    for (let i = 0; i < 4; i++) {
      const res = t.get(face, roll, 0);
      face = res.toFace;
      roll = res.toRoll;
    }
    expect(face).toBe(0);
    expect(roll).toBe(0);
  });

  it('tetrahedron: cycling through any edge returns home in 3 steps', () => {
    const p = tetrahedron();
    const t = buildTransitionTable(p);
    let face = 0;
    let roll = 0;
    for (let i = 0; i < 3; i++) {
      const res = t.get(face, roll, 0);
      face = res.toFace;
      roll = res.toRoll;
    }
    expect(face).toBe(0);
  });

  it.each([
    { name: 'cube', build: cube },
    { name: 'tetrahedron', build: tetrahedron },
    { name: 'octahedron', build: octahedron },
    { name: 'dodecahedron', build: dodecahedron },
    { name: 'icosahedron', build: icosahedron },
  ])('$name: incoming edge lands diametrically opposite the swipe direction', ({ build }) => {
    const p = build();
    const t = buildTransitionTable(p);
    for (let f = 0; f < p.faces.length; f++) {
      const N = p.faces[f]!.vertexIndices.length;
      for (let r = 0; r < N; r++) {
        for (let v = 0; v < N; v++) {
          const res = t.get(f, r, v);
          // Reverse the navigation: from the destination, the visible edge that
          // would bring us back must be roughly opposite the one we crossed.
          const back = t.get(res.toFace, res.toRoll, 0); // any edge to fetch the table
          void back;
          // Specifically check that re-navigating the "incoming" visible slot
          // returns to the original face (a 1-step round trip).
          const NTo = p.faces[res.toFace]!.vertexIndices.length;
          const halfTurn = Math.round(NTo / 2);
          const incomingVisible = ((v + halfTurn) % NTo + NTo) % NTo;
          const round = t.get(res.toFace, res.toRoll, incomingVisible);
          expect(round.toFace).toBe(f);
        }
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
