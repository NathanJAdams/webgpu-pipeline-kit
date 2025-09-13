import { Vector3 } from './Vector3';

export type QuaternionValues = readonly [number, number, number, number];

export class Quaternion {
  static readonly IDENTITY = new Quaternion(0, 0, 0, 1);

  readonly values: QuaternionValues;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly z: number,
    readonly w: number
  ) {
    this.values = [x, y, z, w];
  }

  static fromAxisAngle(axis: Vector3, radians: number): Quaternion {
    const halfAngle = radians * 0.5;
    const s = Math.sin(halfAngle);
    const c = Math.cos(halfAngle);
    return new Quaternion(
      axis.x * s,
      axis.y * s,
      axis.z * s,
      c
    );
  }

  conjugate(): Quaternion {
    return new Quaternion(-this.x, -this.y, -this.z, this.w);
  }

  length(): number {
    return Math.hypot(this.x, this.y, this.z, this.w);
  }

  lengthSquared(): number {
    return this.x ** 2 + this.y ** 2 + this.z ** 2 + this.w ** 2;
  }

  multiply(multiplier: Quaternion): Quaternion {
    const x1 = this.x;
    const y1 = this.y;
    const z1 = this.z;
    const w1 = this.w;
    const x2 = multiplier.x;
    const y2 = multiplier.y;
    const z2 = multiplier.z;
    const w2 = multiplier.w;
    return new Quaternion(
      w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
      w1 * y2 + y1 * w2 + z1 * x2 - x1 * z2,
      w1 * z2 + z1 * w2 + x1 * y2 - y1 * x2,
      w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2
    );
  }

  normalize(epsilon: number = 1e-6): Quaternion {
    const lengthSq = this.lengthSquared();
    if (lengthSq <= (epsilon * epsilon)) {
      return Quaternion.IDENTITY;
    }
    const inverseLength = 1 / Math.sqrt(lengthSq);
    return new Quaternion(
      this.x * inverseLength,
      this.y * inverseLength,
      this.z * inverseLength,
      this.w * inverseLength
    );
  }

  slerp(target: Quaternion, proportion: number): Quaternion {
    if (proportion <= 0) {
      return this;
    }
    if (proportion >= 1) {
      return target;
    }
    const dot = this.x * target.x + this.y * target.y + this.z * target.z + this.w * target.w;
    if (dot < 0) {
      target = new Quaternion(-target.x, -target.y, -target.z, -target.w);
    }
    const theta_0 = Math.acos(dot);
    const theta = theta_0 * proportion;
    const sinTheta = Math.sin(theta_0);
    const s0 = Math.cos(theta) - dot * Math.sin(theta) / sinTheta;
    const s1 = Math.sin(theta) / sinTheta;
    return new Quaternion(
      s0 * this.x + s1 * target.x,
      s0 * this.y + s1 * target.y,
      s0 * this.z + s1 * target.z,
      s0 * this.w + s1 * target.w
    );
  }
}
