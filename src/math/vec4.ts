export type Vec4 = readonly [number, number, number, number];

export const Vec4 = {
  of(x: number, y: number, z: number, w: number): Vec4 {
    return [x, y, z, w];
  },
  fromVec3(v: readonly [number, number, number], w: number): Vec4 {
    return [v[0], v[1], v[2], w];
  },
};
