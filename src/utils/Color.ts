export type Color = {
    r: number;
    g: number;
    b: number;
    a?: number;
};

export const Color = {
  BLACK: { r: 0, g: 0, b: 0, a: 1 } as Color,
  RED: { r: 1, g: 0, b: 0, a: 1 } as Color,
  GREEN: { r: 0, g: 1, b: 0, a: 1 } as Color,
  BLUE: { r: 0, g: 0, b: 1, a: 1 } as Color,
  WHITE: { r: 1, g: 1, b: 1, a: 1 } as Color,

  of(r = 0, g = 0, b = 0, a = 1): Color {
    return {
      r,
      g,
      b,
      a,
    };
  },
  equals(a: Color, b: Color, epsilon = 1e-6): boolean {
    return (
      Math.abs(a.r - b.r) < epsilon &&
            Math.abs(a.g - b.g) < epsilon &&
            Math.abs(a.b - b.b) < epsilon &&
            Math.abs((a.a || 1) - (b.a || 1)) < epsilon
    );
  },
};
