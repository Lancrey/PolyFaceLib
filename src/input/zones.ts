import type { FaceModel } from '../core/projector';

export interface FaceZones {
  /**
   * Edge polygons in face-local CSS coordinates (centered, Y-down).
   * Each zone is a triangle: [centerPoint, edgeVertexA, edgeVertexB].
   */
  edgeZones: readonly (readonly [number, number])[][];
  /** Radius of the central dead zone (in CSS pixels). */
  deadZoneRadius: number;
  /** Centroid of the face in CSS-local coords (typically 0,0 since the bounding box is centered on the face centroid). */
  center: readonly [number, number];
}

/**
 * Build per-face hit-test zones: triangles from the centroid to each edge.
 */
export function buildFaceZones(model: FaceModel, centerDeadZone: number): FaceZones {
  const poly = model.polygon2D;
  // Centroid of the polygon (not the bounding-box center).
  let cx = 0, cy = 0;
  for (const [x, y] of poly) {
    cx += x;
    cy += y;
  }
  cx /= poly.length;
  cy /= poly.length;

  // Inradius approximation: minimum distance from centroid to any edge.
  let inradius = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    // perpendicular distance from (cx, cy) to line a-b
    const dist = Math.abs(dy * cx - dx * cy + b[0] * a[1] - b[1] * a[0]) / len;
    if (dist < inradius) inradius = dist;
  }
  if (!Number.isFinite(inradius)) inradius = 0;

  const deadZoneRadius = inradius * Math.max(0, Math.min(1, centerDeadZone));

  const edgeZones: (readonly [number, number])[][] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    edgeZones.push([[cx, cy], [a[0], a[1]], [b[0], b[1]]]);
  }

  return { edgeZones, deadZoneRadius, center: [cx, cy] };
}

/**
 * Identify which edge zone a 2D point falls into (in face-local coords).
 * Returns -1 if it falls in the dead zone or outside the polygon.
 */
export function hitTestZones(zones: FaceZones, x: number, y: number): number {
  // Dead zone first (small disc around the centroid).
  const dx = x - zones.center[0];
  const dy = y - zones.center[1];
  if (Math.hypot(dx, dy) < zones.deadZoneRadius) return -1;

  for (let i = 0; i < zones.edgeZones.length; i++) {
    const tri = zones.edgeZones[i]!;
    if (pointInTriangle(x, y, tri[0]!, tri[1]!, tri[2]!)) return i;
  }
  return -1;
}

function pointInTriangle(
  px: number, py: number,
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
): boolean {
  const v0x = c[0] - a[0];
  const v0y = c[1] - a[1];
  const v1x = b[0] - a[0];
  const v1y = b[1] - a[1];
  const v2x = px - a[0];
  const v2y = py - a[1];
  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;
  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-9) return false;
  const u = (dot11 * dot02 - dot01 * dot12) / denom;
  const v = (dot00 * dot12 - dot01 * dot02) / denom;
  return u >= 0 && v >= 0 && u + v <= 1;
}

/**
 * Pick the visible edge index whose midpoint angle (radians, atan2(y, x))
 * is closest to the given direction angle.
 */
export function pickEdgeByAngle(midpointAngles: readonly number[], directionAngle: number): number {
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < midpointAngles.length; i++) {
    const d = angularDistance(midpointAngles[i]!, directionAngle);
    if (d < bestDelta) {
      bestDelta = d;
      best = i;
    }
  }
  return best;
}

function angularDistance(a: number, b: number): number {
  let d = Math.abs(a - b) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}
