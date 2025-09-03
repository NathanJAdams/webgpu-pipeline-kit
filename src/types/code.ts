//#region swizzles
type WPKSwizzleColorComponent1 = 'r';
type WPKSwizzleColorComponent2 = WPKSwizzleColorComponent1 | 'g';
type WPKSwizzleColorComponent3 = WPKSwizzleColorComponent2 | 'b';
type WPKSwizzleColorComponent4 = WPKSwizzleColorComponent3 | 'a';
type WPKSwizzleColor1 = `${WPKSwizzleColorComponent1}`;
type WPKSwizzleColor2 = `${WPKSwizzleColorComponent2}${WPKSwizzleColorComponent2}`;
type WPKSwizzleColor3 = `${WPKSwizzleColorComponent3}${WPKSwizzleColorComponent3}${WPKSwizzleColorComponent3}`;
type WPKSwizzleColor4 = `${WPKSwizzleColorComponent4}${WPKSwizzleColorComponent4}${WPKSwizzleColorComponent4}${WPKSwizzleColorComponent4}`;
type WPKSwizzleCoordComponent1 = 'x';
type WPKSwizzleCoordComponent2 = WPKSwizzleCoordComponent1 | 'y';
type WPKSwizzleCoordComponent3 = WPKSwizzleCoordComponent2 | 'z';
type WPKSwizzleCoordComponent4 = WPKSwizzleCoordComponent3 | 'w';
type WPKSwizzleCoord1 = `${WPKSwizzleCoordComponent1}`;
type WPKSwizzleCoord2 = `${WPKSwizzleCoordComponent2}${WPKSwizzleCoordComponent2}`;
type WPKSwizzleCoord3 = `${WPKSwizzleCoordComponent3}${WPKSwizzleCoordComponent3}${WPKSwizzleCoordComponent3}`;
type WPKSwizzleCoord4 = `${WPKSwizzleCoordComponent4}${WPKSwizzleCoordComponent4}${WPKSwizzleCoordComponent4}${WPKSwizzleCoordComponent4}`;
type WPKSwizzleLength1 = WPKSwizzleColor1 | WPKSwizzleCoord1;
type WPKSwizzleLength2 = WPKSwizzleColor2 | WPKSwizzleCoord2;
type WPKSwizzleLength3 = WPKSwizzleColor3 | WPKSwizzleCoord3;
type WPKSwizzleLength4 = WPKSwizzleColor4 | WPKSwizzleCoord4;
export type WPKSwizzle1 = WPKSwizzleLength1;
export type WPKSwizzle2 = WPKSwizzle1 | WPKSwizzleLength2;
export type WPKSwizzle3 = WPKSwizzle2 | WPKSwizzleLength3;
export type WPKSwizzle4 = WPKSwizzle3 | WPKSwizzleLength4;
//#endregion

//#region matrix indices
type WPKMatrixDimension2 = 0 | 1;
type WPKMatrixDimension3 = WPKMatrixDimension2 | 2;
type WPKMatrixDimension4 = WPKMatrixDimension3 | 3;
export type WPKMatrixIndexes2x2 = `_${WPKMatrixDimension2}_${WPKMatrixDimension2}`;
export type WPKMatrixIndexes2x3 = `_${WPKMatrixDimension2}_${WPKMatrixDimension3}`;
export type WPKMatrixIndexes2x4 = `_${WPKMatrixDimension2}_${WPKMatrixDimension4}`;
export type WPKMatrixIndexes3x2 = `_${WPKMatrixDimension3}_${WPKMatrixDimension2}`;
export type WPKMatrixIndexes3x3 = `_${WPKMatrixDimension3}_${WPKMatrixDimension3}`;
export type WPKMatrixIndexes3x4 = `_${WPKMatrixDimension3}_${WPKMatrixDimension4}`;
export type WPKMatrixIndexes4x2 = `_${WPKMatrixDimension4}_${WPKMatrixDimension2}`;
export type WPKMatrixIndexes4x3 = `_${WPKMatrixDimension4}_${WPKMatrixDimension3}`;
export type WPKMatrixIndexes4x4 = `_${WPKMatrixDimension4}_${WPKMatrixDimension4}`;
//#endregion
