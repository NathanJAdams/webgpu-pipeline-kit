export const float32ToFloat16 = (val: number): number => {
  const floatView = new Float32Array(1);
  const intView = new Uint32Array(floatView.buffer);

  floatView[0] = val;
  const x = intView[0];

  const sign = (x >>> 31) << 15;
  const exponent = ((x >> 23) & 0xff) - 127 + 15;
  const mantissa = x & 0x7fffff;

  if (exponent <= 0) {
    // Too small to be represented as normalized half-float
    if (exponent < -10) {
      // Underflow
      return sign;
    }
    const m = (mantissa | 0x800000) >> (1 - exponent);
    return sign | ((m + 0x1000) >> 13);
  } else if (exponent === 0xff - 127 + 15) {
    if (mantissa === 0) {
      // Infinity
      return sign | 0x7c00;
    }
    // NaN
    return sign | 0x7c00 | ((mantissa >> 13) || 1);
  } else if (exponent >= 0x1f) {
    // Overflow to Infinity
    return sign | 0x7c00;
  }

  return sign | (exponent << 10) | ((mantissa + 0x1000) >> 13);
};
