import { describe, it, expect } from 'vitest';
import { PolyFaceLib } from '../src/public-api';
import { cube, tetrahedron } from '../src/polyhedra/presets';

function makeContainer(): HTMLElement {
  const div = document.createElement('div');
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, x: 0, y: 0, toJSON: () => ({}) }),
  });
  document.body.appendChild(div);
  return div;
}

describe('PolyFaceLib', () => {
  it('initializes and emits resize event', () => {
    const c = makeContainer();
    const view = new PolyFaceLib({ container: c, polyhedron: cube() });
    let received = false;
    view.on('resize', () => { received = true; });
    view.resize();
    expect(view.getFaceCount()).toBe(6);
    expect(received).toBe(true);
    view.destroy();
  });

  it('navigateEdge transitions to a different face', async () => {
    const c = makeContainer();
    const view = new PolyFaceLib({
      container: c,
      polyhedron: cube(),
      animation: { duration: 0 },
    });
    const before = view.getCurrentFace().index;
    let after = -1;
    view.on('afterNavigate', e => { after = e.to; });
    await view.navigateEdge(0);
    expect(after).not.toBe(-1);
    expect(after).not.toBe(before);
    view.destroy();
  });

  it('setFace replaces face content disposers', () => {
    const c = makeContainer();
    const view = new PolyFaceLib({ container: c, polyhedron: tetrahedron() });
    view.setFace(0, { type: 'text', text: 'Hello' });
    view.setFace(0, { type: 'text', text: 'World' });
    expect(c.querySelector('.pf-face--0')?.textContent).toContain('World');
    view.destroy();
  });

  it('throws on invalid container', () => {
    expect(() => new PolyFaceLib({ container: '#nope', polyhedron: cube() })).toThrow();
  });

  it('goToFace skips animation when animate=false', async () => {
    const c = makeContainer();
    const view = new PolyFaceLib({ container: c, polyhedron: cube() });
    await view.goToFace(3, { animate: false });
    expect(view.getCurrentFace().index).toBe(3);
    view.destroy();
  });

  it('goToFace(animate:false) reports the previous face in afterNavigate.from', async () => {
    const c = makeContainer();
    const view = new PolyFaceLib({ container: c, polyhedron: cube() });
    let captured: { from: number; to: number } | null = null;
    view.on('afterNavigate', e => { captured = e; });
    await view.goToFace(2, { animate: false });
    expect(captured).not.toBeNull();
    expect(captured!.from).toBe(0);
    expect(captured!.to).toBe(2);
    view.destroy();
  });
});
