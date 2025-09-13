import { Quaternion } from './Quaternion';
import { Vector3 } from './Vector3';

export class Transformation {
  private position: Vector3;
  private rotation: Quaternion;
  private scale: Vector3;
  private isDirtyPosition: boolean = true;
  private isDirtyRotation: boolean = true;
  private isDirtyScale: boolean = true;
  private matrix: Float32Array = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);

  constructor(
    initialPosition: Vector3,
    initialRotation: Quaternion,
    initialScale: Vector3,
  ) {
    this.position = initialPosition;
    this.rotation = initialRotation;
    this.scale = initialScale;
  }

  setPosition(position: Vector3): void {
    this.isDirtyPosition = true;
    this.position = position;
  }

  setRotation(rotation: Quaternion): void {
    this.isDirtyRotation = true;
    this.rotation = rotation;
  }

  setScale(scale: Vector3): void {
    this.isDirtyScale = true;
    this.scale = scale;
  }

  toArray(): Readonly<Float32Array> {
    const m = this.matrix;
    if (this.isDirtyRotation || this.isDirtyScale) {
      const { x: sx, y: sy, z: sz } = this.scale;
      const { x: qx, y: qy, z: qz, w: qw } = this.rotation;
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
      m[4] = (2 * (xy - wz)) * sy;
      m[5] = (1 - 2 * (xx + zz)) * sy;
      m[6] = (2 * (yz + wx)) * sy;
      m[8] = (2 * (xz + wy)) * sz;
      m[9] = (2 * (yz - wx)) * sz;
      m[10] = (1 - 2 * (xx + yy)) * sz;
      this.isDirtyRotation = false;
      this.isDirtyScale = false;
    }
    if (this.isDirtyPosition) {
      m[12] = this.position.x;
      m[13] = this.position.y;
      m[14] = this.position.z;
      this.isDirtyPosition = false;
    }
    return m;
  }
}
