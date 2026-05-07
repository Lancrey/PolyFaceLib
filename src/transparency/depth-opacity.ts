import type { FaceFrame } from '../core/projector';

export type TransparencyCurve = 'linear' | 'smoothstep' | ((t: number) => number);

export interface TransparencyConfig {
  enabled: boolean;
  /** Opacity for the closest face (smaller = more transparent). Default 0.3. */
  nearOpacity?: number;
  /** Opacity for the farthest face. Default 0.9. */
  farOpacity?: number;
  curve?: TransparencyCurve;
  /** If true, faces with a normal pointing away from the camera get opacity 0. */
  cullBackFaces?: boolean;
}

export const DEFAULT_TRANSPARENCY: Required<TransparencyConfig> = {
  enabled: false,
  nearOpacity: 0.3,
  farOpacity: 0.9,
  curve: 'smoothstep',
  cullBackFaces: false,
};

function applyCurve(curve: TransparencyCurve, t: number): number {
  if (curve === 'linear') return t;
  if (curve === 'smoothstep') return t * t * (3 - 2 * t);
  return curve(t);
}

/**
 * Mutates the FaceFrame array, assigning each face an opacity based on its
 * relative depth among visible faces.
 */
export function applyTransparency(
  frames: FaceFrame[],
  config: TransparencyConfig,
): void {
  const merged: Required<TransparencyConfig> = { ...DEFAULT_TRANSPARENCY, ...config };
  if (!merged.enabled) return;

  let minDepth = Infinity;
  let maxDepth = -Infinity;
  for (const f of frames) {
    if (merged.cullBackFaces && f.backFacing) continue;
    if (f.depth < minDepth) minDepth = f.depth;
    if (f.depth > maxDepth) maxDepth = f.depth;
  }

  const range = maxDepth - minDepth;
  for (const f of frames) {
    if (merged.cullBackFaces && f.backFacing) {
      f.opacity = 0;
      continue;
    }
    if (range <= 1e-6) {
      f.opacity = merged.farOpacity;
      continue;
    }
    const t = (f.depth - minDepth) / range;
    const eased = applyCurve(merged.curve, t);
    f.opacity = merged.nearOpacity + (merged.farOpacity - merged.nearOpacity) * eased;
  }
}
