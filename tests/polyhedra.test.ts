import { describe, it, expect } from 'vitest';
import { cube, tetrahedron, octahedron, dodecahedron, icosahedron, prism } from '../src/polyhedra/presets';
import { validatePolyhedron, faceNormal, faceCentroid } from '../src/polyhedra/polyhedron';
import { buildAdjacency } from '../src/polyhedra/adjacency';
import { canonicalOrientation } from '../src/polyhedra/orientations';
import { Quat } from '../src/core/math/quat';
import { Vec3 } from '../src/core/math/vec3';

const presets = [
  { name: 'cube', build: cube, expectedFaces: 6, expectedVerts: 8, expectedEdges: 12 },
  { name: 'tetrahedron', build: tetrahedron, expectedFaces: 4, expectedVerts: 4, expectedEdges: 6 },
  { name: 'octahedron', build: octahedron, expectedFaces: 8, expectedVerts: 6, expectedEdges: 12 },
  { name: 'dodecahedron', build: dodecahedron, expectedFaces: 12, expectedVerts: 20, expectedEdges: 30 },
  { name: 'icosahedron', build: icosahedron, expectedFaces: 20, expectedVerts: 12, expectedEdges: 30 },
];

describe.each(presets)('preset $name', ({ name, build, expectedFaces, expectedVerts, expectedEdges }) => {
  const p = build();

  it('has the correct face & vertex counts', () => {
    expect(p.faces.length).toBe(expectedFaces);
    expect(p.vertices.length).toBe(expectedVerts);
  });

  it('passes validation', () => {
    const r = validatePolyhedron(p);
    expect(r.errors).toEqual([]);
  });

  it('satisfies Euler V - E + F = 2', () => {
    const adj = buildAdjacency(p);
    // Each face's edges count = adj[i].edges.length. Each edge counted twice across faces.
    let halfEdges = 0;
    for (const fa of adj) halfEdges += fa.edges.length;
    const E = halfEdges / 2;
    expect(E).toBe(expectedEdges);
    expect(p.vertices.length - E + p.faces.length).toBe(2);
    void name;
  });

  it('face normals point outward', () => {
    const polyCenter = Vec3.centroid(p.vertices.slice());
    for (let i = 0; i < p.faces.length; i++) {
      const n = faceNormal(p, i);
      const c = faceCentroid(p, i);
      const out = Vec3.sub(c, polyCenter);
      expect(Vec3.dot(n, out)).toBeGreaterThan(0);
    }
  });

  it('adjacency is symmetric', () => {
    const adj = buildAdjacency(p);
    for (const fa of adj) {
      for (const e of fa.edges) {
        const other = adj[e.adjacentFaceIndex]!;
        const back = other.edges[e.adjacentEdgeIndex]!;
        expect(back.adjacentFaceIndex).toBe(fa.faceIndex);
      }
    }
  });

  it('canonical orientation aligns each face normal with +Z and up with +Y', () => {
    for (let i = 0; i < p.faces.length; i++) {
      const co = canonicalOrientation(p, i);
      const n = Quat.rotate(co.rotation, faceNormal(p, i));
      expect(n[0]).toBeCloseTo(0, 6);
      expect(n[1]).toBeCloseTo(0, 6);
      expect(n[2]).toBeCloseTo(1, 6);
      const u = Quat.rotate(co.rotation, co.upObject);
      expect(u[0]).toBeCloseTo(0, 6);
      expect(u[1]).toBeCloseTo(1, 6);
      expect(u[2]).toBeCloseTo(0, 6);
    }
  });
});

describe('prism', () => {
  it('builds a hexagonal prism', () => {
    const p = prism({ sides: 6, height: 2 });
    expect(p.faces.length).toBe(8); // 1 top + 1 bottom + 6 sides
    expect(p.vertices.length).toBe(12);
    const r = validatePolyhedron(p);
    expect(r.errors).toEqual([]);
  });

  it('rejects sides < 3', () => {
    expect(() => prism({ sides: 2 })).toThrow();
  });
});

describe('validatePolyhedron', () => {
  it('rejects an open mesh (missing face)', () => {
    const p = cube();
    const broken = { ...p, faces: p.faces.slice(0, 5) };
    const r = validatePolyhedron(broken);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
