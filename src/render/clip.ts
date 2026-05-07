import type { FaceModel } from '../core/projector';

/**
 * Build a CSS clip-path: polygon(...) for a face. Coordinates are expressed
 * in percentages of the face's bounding rectangle (which is what `clip-path`
 * expects when applied to the face DOM element of size width × height).
 */
export function buildClipPath(model: FaceModel): string {
  const { polygon2D, width, height } = model;
  if (width === 0 || height === 0) return 'none';
  // The face element is sized to width × height with the origin (0,0) at top-left.
  // Polygon2D coords are centered around (0,0); shift them to (width/2, height/2).
  const halfW = width / 2;
  const halfH = height / 2;
  const parts: string[] = [];
  for (const [x, y] of polygon2D) {
    const px = ((x + halfW) / width) * 100;
    const py = ((y + halfH) / height) * 100;
    parts.push(`${px.toFixed(3)}% ${py.toFixed(3)}%`);
  }
  return `polygon(${parts.join(', ')})`;
}

/**
 * Build the safe-area paddings (top / right / bottom / left) given the
 * inscribed rectangle and the bounding-box dimensions.
 */
export function buildSafeAreaPadding(model: FaceModel): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const { inscribedRect, width, height } = model;
  const halfW = width / 2;
  const halfH = height / 2;
  // inscribedRect is centered at (cx, cy) in the face local frame (centered around origin).
  const insTop = inscribedRect.y + halfH;
  const insLeft = inscribedRect.x + halfW;
  const insRight = width - (insLeft + inscribedRect.w);
  const insBottom = height - (insTop + inscribedRect.h);
  return {
    top: Math.max(0, insTop),
    right: Math.max(0, insRight),
    bottom: Math.max(0, insBottom),
    left: Math.max(0, insLeft),
  };
}
