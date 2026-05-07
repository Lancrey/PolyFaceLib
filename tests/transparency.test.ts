import { describe, it, expect } from 'vitest';
import { applyTransparency } from '../src/transparency/depth-opacity';
import type { FaceFrame } from '../src/core/projector';

function makeFrame(depth: number, backFacing = false): FaceFrame {
  return {
    transform: '',
    depth,
    opacity: 1,
    backFacing,
    faceIndex: 0,
  };
}

describe('applyTransparency', () => {
  it('maps closest face → nearOpacity and farthest face → farOpacity', () => {
    // depth convention from Projector: larger value = closer to camera.
    const frames: FaceFrame[] = [
      makeFrame(-900), // farthest
      makeFrame(-800),
      makeFrame(-700), // closest
    ];
    applyTransparency(frames, {
      enabled: true,
      nearOpacity: 0.2,
      farOpacity: 0.8,
      curve: 'linear',
    });
    expect(frames[0]!.opacity).toBeCloseTo(0.8, 5); // farthest → farOpacity
    expect(frames[2]!.opacity).toBeCloseTo(0.2, 5); // closest → nearOpacity
    // middle face: linear interpolation lands halfway.
    expect(frames[1]!.opacity).toBeCloseTo(0.5, 5);
  });

  it('zeros opacity for back faces when cullBackFaces is set', () => {
    const frames: FaceFrame[] = [
      makeFrame(-700, false),
      makeFrame(-800, true),
    ];
    applyTransparency(frames, {
      enabled: true,
      nearOpacity: 0.3,
      farOpacity: 0.9,
      cullBackFaces: true,
    });
    expect(frames[1]!.opacity).toBe(0);
  });

  it('does nothing when disabled', () => {
    const frames: FaceFrame[] = [makeFrame(-700)];
    applyTransparency(frames, { enabled: false });
    expect(frames[0]!.opacity).toBe(1);
  });

  it('uses nearOpacity when all frames share the same depth', () => {
    const frames: FaceFrame[] = [makeFrame(-800), makeFrame(-800)];
    applyTransparency(frames, {
      enabled: true,
      nearOpacity: 0.4,
      farOpacity: 0.9,
    });
    for (const f of frames) expect(f.opacity).toBeCloseTo(0.4, 5);
  });
});
