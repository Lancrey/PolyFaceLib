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

  it('cube: navigate("right") four times returns to the front face', async () => {
    const c = makeContainer();
    const view = new PolyFaceLib({
      container: c,
      polyhedron: cube(),
      animation: { duration: 0 },
    });
    expect(view.getCurrentFace().index).toBe(0);
    for (let i = 0; i < 4; i++) await view.navigate('right');
    expect(view.getCurrentFace().index).toBe(0);
    expect(view.getCurrentFace().roll).toBe(0);
    view.destroy();
  });

  it('every navigation lands at roll=0 (active face stays upright)', async () => {
    const c = makeContainer();
    const view = new PolyFaceLib({
      container: c,
      polyhedron: cube(),
      animation: { duration: 0 },
    });
    for (const dir of ['right', 'down', 'left', 'up', 'right', 'right'] as const) {
      await view.navigate(dir);
      expect(view.getCurrentFace().roll).toBe(0);
    }
    view.destroy();
  });

  it('goToFace skips animation when animate=false', async () => {
    const c = makeContainer();
    const view = new PolyFaceLib({ container: c, polyhedron: cube() });
    await view.goToFace(3, { animate: false });
    expect(view.getCurrentFace().index).toBe(3);
    view.destroy();
  });

  it('projects every face inside a sane fraction of the viewport', () => {
    // Regression: the model matrix used to also scale the already-pixel-sized
    // face element, projecting every corner ~30× the viewport size off-screen.
    const c = makeContainer();
    const view = new PolyFaceLib({ container: c, polyhedron: cube() });
    const faces = c.querySelectorAll('.pf-face');
    expect(faces.length).toBe(6);
    for (const f of faces) {
      const w = parseFloat((f as HTMLElement).style.getPropertyValue('--pf-face-w'));
      const h = parseFloat((f as HTMLElement).style.getPropertyValue('--pf-face-h'));
      const m = (f as HTMLElement).style.transform.match(/matrix3d\(([^)]+)\)/)![1].split(',').map(Number);
      for (const [px, py] of [[w / 2, h / 2], [-w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]]) {
        const tx = m[0]! * px + m[4]! * py + m[12]!;
        const ty = m[1]! * px + m[5]! * py + m[13]!;
        const tw = m[3]! * px + m[7]! * py + m[15]!;
        // Container rect is 400×400, so corners must land within ±400 px of center.
        expect(Math.abs(tx / tw)).toBeLessThan(400);
        expect(Math.abs(ty / tw)).toBeLessThan(400);
      }
    }
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
