export type Vec3 = readonly [number, number, number];

export const vec3Funcs = {
  ZERO: [0, 0, 0] as Vec3,
  ONE: [1, 1, 1] as Vec3,
  X: [1, 0, 0] as Vec3,
  Y: [0, 1, 0] as Vec3,
  Z: [0, 0, 1] as Vec3,

  of(x = 0, y = 0, z = 0): Vec3 {
    return [x, y, z];
  },

  add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  },
  subtract(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },
  cross(a: Vec3, b: Vec3): Vec3 {
    const a0 = a[0];
    const a1 = a[1];
    const a2 = a[2];
    const b0 = b[0];
    const b1 = b[1];
    const b2 = b[2];
    return [
      a1 * b2 - a2 * b1,
      a2 * b0 - a0 * b2,
      a0 * b1 - a1 * b0,
    ];
  },
  dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },
  distance(a: Vec3, b: Vec3): number {
    return vec3Funcs.length(vec3Funcs.subtract(a, b));
  },
  distanceSquared(a: Vec3, b: Vec3): number {
    return vec3Funcs.lengthSquared(vec3Funcs.subtract(a, b));
  },
  length(v: Vec3): number {
    return Math.hypot(v[0], v[1], v[2]);
  },
  lengthSquared(v: Vec3): number {
    return v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
  },
  lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    const a0 = a[0];
    const a1 = a[1];
    const a2 = a[2];
    return [
      a0 + (b[0] - a0) * t,
      a1 + (b[1] - a1) * t,
      a2 + (b[2] - a2) * t,
    ];
  },
  midpoint(a: Vec3, b: Vec3): Vec3 {
    return vec3Funcs.normalize([
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2
    ]);
  },
  negate(v: Vec3): Vec3 {
    return [-v[0], -v[1], -v[2]];
  },
  normalize(v: Vec3): Vec3 {
    const len = vec3Funcs.length(v);
    return len === 0 ? [0, 0, 0] : vec3Funcs.scale(v, 1 / len);
  },
  scale(v: Vec3, scalar: number): Vec3 {
    return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
  },
  equals(a: Vec3, b: Vec3, epsilon = 1e-6): boolean {
    return (
      Math.abs(a[0] - b[0]) < epsilon &&
            Math.abs(a[1] - b[1]) < epsilon &&
            Math.abs(a[2] - b[2]) < epsilon
    );
  },
  toString(v: Vec3): string {
    return `[${v[0].toFixed(3)}, ${v[1].toFixed(3)}, ${v[2].toFixed(3)}]`;
  },
};
