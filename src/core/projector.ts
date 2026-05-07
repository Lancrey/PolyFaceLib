import { Mat4 } from './math/mat4';
import type { Mat4 as Mat4T } from './math/mat4';
import { Quat } from './math/quat';
import type { Quat as QuatT } from './math/quat';
import { Vec3 } from './math/vec3';
import type { Vec3 as Vec3T } from './math/vec3';
import { perspectiveCSS } from './math/projection';
import type { Polyhedron } from '../polyhedra/polyhedron';
import { faceCentroid, faceNormal } from '../polyhedra/polyhedron';
import { canonicalOrientation } from '../polyhedra/orientations';

export interface ProjectorOptions {
  /** Perspective focal length, in pixels-equivalent. Defaults to 800. */
  perspective?: number;
  /** Distance from the camera to the polyhedron center along -Z. Defaults to perspective. */
  cameraDistance?: number;
  /** Effective render size of the polyhedron in pixels (used to scale the geometry). */
  size: number;
}

export interface FaceFrame {
  /** The CSS `transform` value for this face. */
  transform: string;
  /** Depth (in view space) of the face center, used for sorting. */
  depth: number;
  /** Effective opacity (clamped to [0, 1]). */
  opacity: number;
  /** Whether this face is back-facing (normal points away from camera). */
  backFacing: boolean;
  /** Index into the polyhedron's faces array. */
  faceIndex: number;
}

export interface ProjectorFrameInput {
  rotation: QuatT;
  /** Per-frame face content: opacity overrides, etc. (currently unused — depth-based opacity is computed elsewhere). */
}

/**
 * Pre-computed per-face data we never recompute at runtime: the model matrix
 * that takes the canonical "face on +Z, up = +Y" plane to the face's location
 * inside the polyhedron, plus the half-extents needed by the renderer to size
 * the DOM rectangle.
 */
export interface FaceModel {
  /** Model matrix (object → world). */
  model: Mat4T;
  /** Width and height of the bounding rectangle that contains the face polygon. */
  width: number;
  height: number;
  /** 2D coordinates of the face's polygon in the local face frame, used for clip-path. */
  polygon2D: readonly (readonly [number, number])[];
  /** Inscribed rectangle (in local face coords) — { x, y, w, h } centered. */
  inscribedRect: { x: number; y: number; w: number; h: number };
}

export class Projector {
  readonly faceModels: readonly FaceModel[];
  private readonly perspectiveMatrix: Mat4T;
  private readonly cameraTranslate: Mat4T;
  private readonly faceCount: number;

  constructor(
    private readonly polyhedron: Polyhedron,
    opts: ProjectorOptions,
  ) {
    const perspective = opts.perspective ?? 800;
    const cameraDistance = opts.cameraDistance ?? perspective;
    this.perspectiveMatrix = perspectiveCSS(perspective);
    this.cameraTranslate = Mat4.translation(0, 0, -cameraDistance);

    const size = opts.size;
    // Build the per-face model matrix. We scale the normalized polyhedron
    // (vertices roughly bounded by [-1, +1] depending on preset) by half-size,
    // then rotate the canonical face plane to land on the actual face's plane.
    const scale = size / 2;
    const models: FaceModel[] = [];
    for (let i = 0; i < polyhedron.faces.length; i++) {
      models.push(this.buildFaceModel(i, scale));
    }
    this.faceModels = models;
    this.faceCount = polyhedron.faces.length;
  }

  /** Recompute matrices for new size (e.g. after resize). */
  resize(size: number): Projector {
    return new Projector(this.polyhedron, {
      size,
      perspective: this.getPerspective(),
      cameraDistance: this.getCameraDistance(),
    });
  }

  private getPerspective(): number {
    // Encode in matrix; recover from m[10] which equals -1/d.
    const m10 = this.perspectiveMatrix[11] as number;
    if (m10 === 0) return 0;
    return -1 / m10;
  }
  private getCameraDistance(): number {
    return -this.cameraTranslate[14]!;
  }

  /**
   * For face i, build:
   *  - the inverse of the canonical orientation, applied to a unit "+Z face" — that
   *    rotates the unit face into its actual orientation;
   *  - a translation pulling that face from origin to its centroid.
   *  - a scale equal to `size/2`.
   */
  private buildFaceModel(faceIndex: number, scale: number): FaceModel {
    const co = canonicalOrientation(this.polyhedron, faceIndex);
    const invQ = Quat.inverse(co.rotation);
    const rot = Mat4.fromQuat(invQ);

    const centroid = faceCentroid(this.polyhedron, faceIndex);
    const trans = Mat4.translation(scale * centroid[0], scale * centroid[1], scale * centroid[2]);
    const sc = Mat4.scaling(scale, scale, scale);

    // Composition: first rotate the unit face into orientation, then scale, then translate.
    // World = T * R * S
    const model = Mat4.composeChain([trans, rot, sc]);

    // Compute polygon vertices in the *local* face frame (before model transform).
    // Local frame: face on +Z, up = +Y. We project face vertices into this frame
    // by applying canonical orientation to (vertex - centroid).
    const f = this.polyhedron.faces[faceIndex]!;
    const local2D: [number, number][] = [];
    for (const idx of f.vertexIndices) {
      const p = this.polyhedron.vertices[idx]!;
      const rel = Vec3.sub(p, centroid);
      const rotated = Quat.rotate(co.rotation, rel);
      // Now rotated is on the XY plane (z ≈ 0). Take (x, y) and scale.
      local2D.push([rotated[0] * scale, -rotated[1] * scale]); // CSS Y goes down
    }

    // Bounding rect
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of local2D) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const width = maxX - minX;
    const height = maxY - minY;

    // Inscribed rectangle: simple heuristic — largest centered axis-aligned rect inside the polygon.
    const inscribed = inscribedAxisAlignedRect(local2D);

    void faceNormal; // keep import side-effect for type checker

    return { model, width, height, polygon2D: local2D, inscribedRect: inscribed };
  }

  /** Compute per-frame data for every face. */
  computeFrame(input: ProjectorFrameInput): FaceFrame[] {
    const rotMat = Mat4.fromQuat(input.rotation);

    const out: FaceFrame[] = [];
    for (let i = 0; i < this.faceCount; i++) {
      const fm = this.faceModels[i]!;
      // Compose: perspective * camera * rotation * model. CSS browsers will read this matrix3d
      // and apply it to the rectangular DOM element representing the face.
      const transform = Mat4.composeChain([this.perspectiveMatrix, this.cameraTranslate, rotMat, fm.model]);

      // Compute the face's center in view space (after rotation + camera translate, before perspective)
      // for depth ordering and back-face detection.
      const centroidWorld: Vec3T = [
        fm.model[12] as number,
        fm.model[13] as number,
        fm.model[14] as number,
      ];
      const rotatedCentroid = Quat.rotate(input.rotation, centroidWorld);
      const viewZ = rotatedCentroid[2] - this.getCameraDistance();
      const depth = viewZ;

      // Back-face: the face's normal in world space (after rotation) should have a +Z component
      // (pointing toward the camera) for the face to be visible.
      const nObj = faceNormal(this.polyhedron, i);
      const nWorld = Quat.rotate(input.rotation, nObj);
      const backFacing = nWorld[2] <= 0;

      out.push({
        transform: `matrix3d(${Mat4.toCSSMatrix3d(transform)})`,
        depth,
        opacity: 1,
        backFacing,
        faceIndex: i,
      });
    }
    return out;
  }
}

/**
 * Compute the largest centered axis-aligned rectangle entirely inside the
 * polygon defined by `pts2d` (in CSS coords, Y down).
 *
 * Heuristic: binary-search the half-width and half-height that keep the rect
 * inside the polygon. We center the rect on the polygon's centroid.
 */
function inscribedAxisAlignedRect(
  pts2d: readonly (readonly [number, number])[],
): { x: number; y: number; w: number; h: number } {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of pts2d) {
    cx += x;
    cy += y;
  }
  cx /= pts2d.length;
  cy /= pts2d.length;

  // Compute initial bounding-box half-extents
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts2d) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const initHW = Math.min(cx - minX, maxX - cx);
  const initHH = Math.min(cy - minY, maxY - cy);

  // Try the largest centered rect with same aspect ratio as the bbox, shrinking until inside.
  function rectInside(hw: number, hh: number): boolean {
    const corners: [number, number][] = [
      [cx - hw, cy - hh],
      [cx + hw, cy - hh],
      [cx + hw, cy + hh],
      [cx - hw, cy + hh],
    ];
    for (const c of corners) if (!pointInPolygon(c, pts2d)) return false;
    return true;
  }

  let lo = 0, hi = 1, mid = 1;
  for (let it = 0; it < 24; it++) {
    mid = (lo + hi) / 2;
    if (rectInside(initHW * mid, initHH * mid)) lo = mid;
    else hi = mid;
  }
  const hw = initHW * lo;
  const hh = initHH * lo;
  return { x: cx - hw, y: cy - hh, w: 2 * hw, h: 2 * hh };
}

function pointInPolygon(pt: readonly [number, number], poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    const xi = pi[0], yi = pi[1];
    const xj = pj[0], yj = pj[1];
    const intersect = ((yi > pt[1]) !== (yj > pt[1])) &&
      (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
