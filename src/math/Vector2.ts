export class Vector2 {
  static readonly ZERO = new Vector2(0, 0);
  static readonly ONE = new Vector2(1, 1);
  static readonly X = new Vector2(1, 0);
  static readonly Y = new Vector2(0, 1);

  constructor(
    readonly x: number,
    readonly y: number,
  ) { }

  dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  distanceTo(to: Vector2): number {
    return this.minus(to).length();
  }

  distanceSquaredTo(to: Vector2): number {
    return this.minus(to).lengthSquared();
  }

  equals(other: Vector2, epsilon = 1e-6): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon
      && Math.abs(this.y - other.y) < epsilon
    );
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }

  lengthSquared(): number {
    return this.x ** 2 + this.y ** 2;
  }

  lerp(to: Vector2, proportion: number): Vector2 {
    if (proportion <= 0) {
      return this;
    }
    if (proportion >= 1) {
      return to;
    }
    return new Vector2(
      this.x + (to.x - this.x) * proportion,
      this.y + (to.y - this.y) * proportion,
    );
  }

  midpoint(to: Vector2): Vector2 {
    return this.plus(to).scale(0.5).normalize();
  }

  minus(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  negate(): Vector2 {
    return new Vector2(-this.x, -this.y);
  }

  normalize(): Vector2 {
    const len = this.length();
    return len === 0 ? Vector2.ZERO : this.scale(1 / len);
  }

  plus(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  scale(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  toArray(): readonly [number, number] {
    return [this.x, this.y];
  }
}
