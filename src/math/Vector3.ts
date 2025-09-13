export type Vector3Values = readonly [number, number, number];

export class Vector3 {
  static readonly ZERO = new Vector3(0, 0, 0);
  static readonly ONE = new Vector3(1, 1, 1);
  static readonly X = new Vector3(1, 0, 0);
  static readonly Y = new Vector3(0, 1, 0);
  static readonly Z = new Vector3(0, 0, 1);

  readonly values: Vector3Values;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly z: number
  ) {
    this.values = [x, y, z];
  }

  cross(other: Vector3): Vector3 {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    );
  }

  dot(other: Vector3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  distanceTo(to: Vector3): number {
    return this.minus(to).length();
  }

  distanceSquaredTo(to: Vector3): number {
    return this.minus(to).lengthSquared();
  }

  equals(other: Vector3, epsilon = 1e-6): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon
      && Math.abs(this.y - other.y) < epsilon
      && Math.abs(this.z - other.z) < epsilon
    );
  }

  length(): number {
    return Math.hypot(this.x, this.y, this.z);
  }

  lengthSquared(): number {
    return this.x ** 2 + this.y ** 2 + this.z ** 2;
  }

  lerp(to: Vector3, proportion: number): Vector3 {
    if (proportion <= 0) {
      return this;
    }
    if (proportion >= 1) {
      return to;
    }
    return new Vector3(
      this.x + (to.x - this.x) * proportion,
      this.y + (to.y - this.y) * proportion,
      this.z + (to.z - this.z) * proportion,
    );
  }

  midpoint(to: Vector3): Vector3 {
    return this.plus(to).scale(0.5).normalize();
  }

  minus(other: Vector3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  negate(): Vector3 {
    return new Vector3(-this.x, -this.y, -this.z);
  }

  normalize(): Vector3 {
    const len = this.length();
    return len === 0 ? Vector3.ZERO : this.scale(1 / len);
  }

  plus(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  scale(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }
}
