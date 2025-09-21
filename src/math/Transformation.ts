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
  private _matrix: TransformationValues = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];

  get matrix(): Readonly<TransformationValues> {
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

  flushChanges(): void {
    const m = this._matrix;
    if (this.isDirtyRotation || this.isDirtyScale) {
      const { x: sx, y: sy, z: sz } = this._scale;
      const { x: qx, y: qy, z: qz, w: qw } = this._rotation;
      const xx = qx * qx;
      const yy = qy * qy;
      const zz = qz * qz;
      const xy = qx * qy;
      const xz = qx * qz;
      const yz = qy * qz;
      const wx = qw * qx;
      const wy = qw * qy;
      const wz = qw * qz;
      m[0] = (1 - 2 * (yy + zz)) * sx;
      m[1] = (2 * (xy + wz)) * sx;
      m[2] = (2 * (xz - wy)) * sx;
      // m[3] = 0;
      m[4] = (2 * (xy - wz)) * sy;
      m[5] = (1 - 2 * (xx + zz)) * sy;
      m[6] = (2 * (yz + wx)) * sy;
      // m[7] = 0;
      m[8] = (2 * (xz + wy)) * sz;
      m[9] = (2 * (yz - wx)) * sz;
      m[10] = (1 - 2 * (xx + yy)) * sz;
      // m[11] = 0;
      this.isDirtyRotation = false;
      this.isDirtyScale = false;
    }
    if (this.isDirtyPosition) {
      m[12] = this._position.x;
      m[13] = this._position.y;
      m[14] = this._position.z;
      // m[15] = 1;
      this.isDirtyPosition = false;
    }
  }
}
