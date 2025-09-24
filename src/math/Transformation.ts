import { Quaternion } from './Quaternion';
import { Vector3 } from './Vector3';

export type TransformationValues = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export class Transformation {
  private _position = Vector3.ZERO;
  private _rotation = Quaternion.IDENTITY;
  private _scale = Vector3.ONE;
  private isDirtyPosition: boolean = true;
  private isDirtyRotation: boolean = true;
  private isDirtyScale: boolean = true;
  private readonly _matrix: TransformationValues = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];

  get matrix(): Readonly<TransformationValues> {
    this.flushChanges();
    return this._matrix;
  }

  setPosition(position: Vector3) {
    this.isDirtyPosition = true;
    this._position = position;
  }

  setRotation(rotation: Quaternion) {
    this.isDirtyRotation = true;
    this._rotation = rotation;
  }

  setScale(scale: Vector3) {
    this.isDirtyScale = true;
    this._scale = scale;
  }

  private flushChanges(): void {
    if (this.isDirtyRotation || this.isDirtyScale) {
      const { x: sx, y: sy, z: sz } = this._scale;
      const { x: rx, y: ry, z: rz, w: rw } = this._rotation;

      const x2 = rx + rx;
      const y2 = ry + ry;
      const z2 = rz + rz;

      const xx = rx * x2;
      const yy = ry * y2;
      const zz = rz * z2;
      const xy = rx * y2;
      const xz = rx * z2;
      const yz = ry * z2;
      const wx = rw * x2;
      const wy = rw * y2;
      const wz = rw * z2;

      const m00 = (1 - (yy + zz)) * sx;
      const m01 = (xy + wz) * sx;
      const m02 = (xz - wy) * sx;
      const m10 = (xy - wz) * sy;
      const m11 = (1 - (xx + zz)) * sy;
      const m12 = (yz + wx) * sy;
      const m20 = (xz + wy) * sz;
      const m21 = (yz - wx) * sz;
      const m22 = (1 - (xx + yy)) * sz;

      const m = this._matrix;
      m[0] = m00;
      m[1] = m01;
      m[2] = m02;
      m[4] = m10;
      m[5] = m11;
      m[6] = m12;
      m[8] = m20;
      m[9] = m21;
      m[10] = m22;

      this.isDirtyRotation = false;
      this.isDirtyScale = false;
    }

    if (this.isDirtyPosition) {
      const { x, y, z } = this._position;
      const m = this._matrix;
      m[12] = x;
      m[13] = y;
      m[14] = z;

      this.isDirtyPosition = false;
    }
  }
}
