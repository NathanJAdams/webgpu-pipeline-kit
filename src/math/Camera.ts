import { Quaternion } from './Quaternion';
import { Vector3 } from './Vector3';

export type CameraMatrixValues = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export class Camera {
  private _position = Vector3.ZERO;
  private _rotation = Quaternion.IDENTITY;
  private _fieldOfViewDegrees = 60;
  private _aspectRatio = 1;
  private _nearFar: [number, number] = [1, 1000];
  private isDirtyPosition: boolean = true;
  private isDirtyRotation: boolean = true;
  private isDirtyAspectRatio: boolean = true;
  private isDirtyFieldOfView: boolean = true;
  private isDirtyNearFar: boolean = true;
  private readonly _viewMatrix: CameraMatrixValues = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
  private readonly _projectionMatrix: CameraMatrixValues = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, -1,
    0, 0, 2, 0,
  ];
  private readonly _viewProjectionMatrix: CameraMatrixValues = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];

  constructor(
    private readonly enableViewProjectionMatrix: boolean
  ) { }

  get viewMatrix(): Readonly<CameraMatrixValues> {
    this.flushChanges();
    return this._viewMatrix;
  }
  get projectionMatrix(): Readonly<CameraMatrixValues> {
    this.flushChanges();
    return this._projectionMatrix;
  }
  get viewProjectionMatrix(): Readonly<CameraMatrixValues> {
    if (!this.enableViewProjectionMatrix) {
      throw Error('The `enableViewProjectionMatrix` flag in the constructor must be `true` to allow using it');
    }
    this.flushChanges();
    return this._viewProjectionMatrix;
  }

  setPosition(position: Vector3) {
    this.isDirtyPosition = true;
    this._position = position;
  }
  setRotation(rotation: Quaternion) {
    this.isDirtyRotation = true;
    this._rotation = rotation;
  }
  setFieldOfView(fieldOfView: number) {
    if (fieldOfView <= 0 || fieldOfView >= 180) {
      throw new Error(`FOV must be between 0 and 180 degrees but is ${fieldOfView}`);
    }
    this.isDirtyFieldOfView = true;
    this._fieldOfViewDegrees = fieldOfView;
  }
  setAspectRatio(aspectRatio: number) {
    this.isDirtyAspectRatio = true;
    this._aspectRatio = aspectRatio;
  }
  setNearFar(nearFar: [number, number]) {
    if (nearFar[0] <= 0 || nearFar[1] <= 0) {
      throw new Error(`Both near and far bounds must be positive but are [${nearFar[0]}, ${nearFar[1]}]`);
    }
    if (nearFar[0] >= nearFar[1]) {
      throw new Error(`Near bound must be lower than far bound but are [${nearFar[0]}, ${nearFar[1]}]`);
    }
    this.isDirtyNearFar = true;
    this._nearFar = nearFar;
  }

  translate(offset: Vector3): void {
    this.setPosition(this._position.plus(offset));
  }

  rotate(rotation: Quaternion): void {
    this.setRotation(this._rotation.multiply(rotation).normalize());
  }

  private flushChanges(): void {
    let viewChanged = false;
    let projectionChanged = false;

    if (this.isDirtyPosition || this.isDirtyRotation) {
      const { x: rx, y: ry, z: rz, w: rw } = this._rotation;
      const { x: px, y: py, z: pz } = this._position;

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

      const m00 = 1 - (yy + zz);
      const m01 = xy + wz;
      const m02 = xz - wy;
      const m10 = xy - wz;
      const m11 = 1 - (xx + zz);
      const m12 = yz + wx;
      const m20 = xz + wy;
      const m21 = yz - wx;
      const m22 = 1 - (xx + yy);

      const vm = this._viewMatrix;
      vm[0] = m00;
      vm[1] = m01;
      vm[2] = m02;
      vm[4] = m10;
      vm[5] = m11;
      vm[6] = m12;
      vm[8] = m20;
      vm[9] = m21;
      vm[10] = m22;
      vm[12] = m00 * -px + m10 * -py + m20 * -pz;
      vm[13] = m01 * -px + m11 * -py + m21 * -pz;
      vm[14] = m02 * -px + m12 * -py + m22 * -pz;

      this.isDirtyPosition = false;
      this.isDirtyRotation = false;
      viewChanged = true;
    }

    if (this.isDirtyFieldOfView || this.isDirtyAspectRatio || this.isDirtyNearFar) {
      const fovRad = (this._fieldOfViewDegrees * Math.PI) / 180;
      const f = 1.0 / Math.tan(fovRad / 2);
      const [near, far] = this._nearFar;
      const nf = 1 / (near - far);

      const pm = this._projectionMatrix;
      pm[0] = f / this._aspectRatio;
      pm[5] = f;
      pm[10] = (far + near) * nf;
      pm[14] = (2 * far * near) * nf;

      this.isDirtyFieldOfView = false;
      this.isDirtyAspectRatio = false;
      this.isDirtyNearFar = false;
      projectionChanged = true;
    }

    if (this.enableViewProjectionMatrix && (viewChanged || projectionChanged)) {
      const vm = this._viewMatrix;
      const pm = this._projectionMatrix;
      const vpm = this._viewProjectionMatrix;

      const pm00 = pm[0];
      const pm11 = pm[5];
      const pm22 = pm[10];
      const pm32 = pm[14];

      const vm20 = vm[8];
      const vm21 = vm[9];
      const vm22 = vm[10];
      const vm23 = vm[11];

      vpm[0] = pm00 * vm[0];
      vpm[1] = pm00 * vm[1];
      vpm[2] = pm00 * vm[2];
      vpm[3] = pm00 * vm[3];
      vpm[4] = pm11 * vm[4];
      vpm[5] = pm11 * vm[5];
      vpm[6] = pm11 * vm[6];
      vpm[7] = pm11 * vm[7];
      vpm[8] = pm22 * vm20 - vm[12];
      vpm[9] = pm22 * vm21 - vm[13];
      vpm[10] = pm22 * vm22 - vm[14];
      vpm[11] = pm22 * vm23 - vm[15];
      vpm[12] = pm32 * vm20;
      vpm[13] = pm32 * vm21;
      vpm[14] = pm32 * vm22;
      vpm[15] = pm32 * vm23;
    }
  }
}
