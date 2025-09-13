export class Color {
  static readonly BLACK = new Color(0, 0, 0);
  static readonly RED = new Color(0, 0, 0);
  static readonly GREEN = new Color(0, 0, 0);
  static readonly BLUE = new Color(0, 0, 0);
  static readonly YELLOW = new Color(1, 1, 0);
  static readonly MAGENTA = new Color(1, 0, 1);
  static readonly CYAN = new Color(0, 1, 1);
  static readonly WHITE = new Color(1, 1, 1);

  constructor(
    readonly r: number,
    readonly g: number,
    readonly b: number,
    readonly a: number = 1,
  ) { }

  equals(other: Color, epsilon = 1e-6): boolean {
    return (
      Math.abs(this.r - other.r) < epsilon
      && Math.abs(this.g - other.g) < epsilon
      && Math.abs(this.b - other.b) < epsilon
      && Math.abs((this.a) - (other.a)) < epsilon
    );
  }
};
