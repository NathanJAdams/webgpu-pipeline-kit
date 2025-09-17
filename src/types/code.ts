import { WPKShaderDimension } from './structs';

//#region swizzles
type WPKSwizzleComponentColor1 = 'r';
type WPKSwizzleComponentColor2 = WPKSwizzleComponentColor1 | 'g';
type WPKSwizzleComponentColor3 = WPKSwizzleComponentColor2 | 'b';
type WPKSwizzleComponentColor4 = WPKSwizzleComponentColor3 | 'a';
type WPKSwizzleComponentsColor = [never, WPKSwizzleComponentColor1, WPKSwizzleComponentColor2, WPKSwizzleComponentColor3, WPKSwizzleComponentColor4];
type WPKSwizzleComponentCoord1 = 'x';
type WPKSwizzleComponentCoord2 = WPKSwizzleComponentCoord1 | 'y';
type WPKSwizzleComponentCoord3 = WPKSwizzleComponentCoord2 | 'z';
type WPKSwizzleComponentCoord4 = WPKSwizzleComponentCoord3 | 'w';
type WPKSwizzleComponentsCoord = [never, WPKSwizzleComponentCoord1, WPKSwizzleComponentCoord2, WPKSwizzleComponentCoord3, WPKSwizzleComponentCoord4];
type WPKSwizzleLength = 1 | 2 | 3 | 4;
export type WPKSwizzle<TVectorLength extends WPKShaderDimension, TSwizzleLength extends WPKSwizzleLength> =
  TSwizzleLength extends 1
  ? (
    | `${WPKSwizzleComponentsColor[TVectorLength]}`
    | `${WPKSwizzleComponentsCoord[TVectorLength]}`
  )
  : TSwizzleLength extends 2
  ? (
    | `${WPKSwizzleComponentsColor[TVectorLength]}${WPKSwizzleComponentsColor[TVectorLength]}`
    | `${WPKSwizzleComponentsCoord[TVectorLength]}${WPKSwizzleComponentsCoord[TVectorLength]}`
  )
  : TSwizzleLength extends 3
  ? (
    | `${WPKSwizzleComponentsColor[TVectorLength]}${WPKSwizzleComponentsColor[TVectorLength]}${WPKSwizzleComponentsColor[TVectorLength]}`
    | `${WPKSwizzleComponentsCoord[TVectorLength]}${WPKSwizzleComponentsCoord[TVectorLength]}${WPKSwizzleComponentsCoord[TVectorLength]}`
  )
  : TSwizzleLength extends 4
  ? (
    | `${WPKSwizzleComponentsColor[TVectorLength]}${WPKSwizzleComponentsColor[TVectorLength]}${WPKSwizzleComponentsColor[TVectorLength]}${WPKSwizzleComponentsColor[TVectorLength]}`
    | `${WPKSwizzleComponentsCoord[TVectorLength]}${WPKSwizzleComponentsCoord[TVectorLength]}${WPKSwizzleComponentsCoord[TVectorLength]}${WPKSwizzleComponentsCoord[TVectorLength]}`
  )
  : never
  ;
//#endregion

//#region matrix indices
type WPKMatrixDimension2 = 0 | 1;
type WPKMatrixDimension3 = WPKMatrixDimension2 | 2;
type WPKMatrixDimension4 = WPKMatrixDimension3 | 3;
type WPKMatrixDimensions = [never, never, WPKMatrixDimension2, WPKMatrixDimension3, WPKMatrixDimension4];
export type WPKMatrixIndices<TColumns extends WPKShaderDimension, TRows extends WPKShaderDimension> = `_${WPKMatrixDimensions[TColumns]}_${WPKMatrixDimensions[TRows]}`;
//#endregion
