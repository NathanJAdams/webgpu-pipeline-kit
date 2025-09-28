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
  private _near: number = 0.1;
  private _far: number = 1000;
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

  get viewMatrix(): Readonly<CameraMatrixValues> {
    this.flushChanges(true, false);
    return this._viewMatrix;
  }
  get projectionMatrix(): Readonly<CameraMatrixValues> {
    this.flushChanges(false, true);
    return this._projectionMatrix;
  }
  get viewProjectionMatrix(): Readonly<CameraMatrixValues> {
    this.flushChanges(true, true);
    return this._viewProjectionMatrix;
  }

  get position(): Vector3 {
    return this._position;
  }
  get rotation(): Quaternion {
    return this._rotation;
  }
  get fieldOfViewDegrees(): number {
    return this._fieldOfViewDegrees;
  }
  get aspectRatio(): number {
    return this._aspectRatio;
  }
  get near(): number {
    return this._near;
  }
  get far(): number {
    return this._far;
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
  setNearFar(near: number, far: number) {
    if (near <= 0 || far <= 0) {
      throw new Error(`Both near and far bounds must be positive but are [${near}, ${far}]`);
    }
    if (near >= far) {
      throw new Error(`Near bound must be lower than far bound but are [${near}, ${far}]`);
    }
    this.isDirtyNearFar = true;
    this._near = near;
    this._far = far;
  }

  translate(offset: Vector3): void {
    this.setPosition(this._position.plus(offset));
  }

  rotate(rotation: Quaternion): void {
    this.setRotation(this._rotation.multiply(rotation).normalize());
  }

  private flushChanges(flushView: boolean, flushProjection: boolean): void {
    if (flushView) {
      flushView = this.updateView();
    }
    if (flushProjection) {
      flushProjection = this.updateProjection();
    }
    if (flushView || flushProjection) {
      this.updateViewProjection();
    }
  }

  private updateView(): boolean {
    if (!this.isDirtyPosition && !this.isDirtyRotation) {
      return false;
    }
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
    vm[12] = -(m00 * px + m01 * py + m02 * pz);
    vm[13] = -(m10 * px + m11 * py + m12 * pz);
    vm[14] = -(m20 * px + m21 * py + m22 * pz);

    this.isDirtyPosition = false;
    this.isDirtyRotation = false;
    return true;
  }

  private updateProjection(): boolean {
    if (!this.isDirtyFieldOfView && !this.isDirtyAspectRatio && !this.isDirtyNearFar) {
      return false;
    }
    const fovRad = (this._fieldOfViewDegrees * Math.PI) / 180;
    const f = 1.0 / Math.tan(fovRad / 2);
    const near = this._near;
    const far = this._far;
    const nf = 1 / (near - far);

    const pm = this._projectionMatrix;
    pm[0] = f / this._aspectRatio;
    pm[5] = f;
    pm[10] = (far + near) * nf;
    pm[14] = (2 * far * near) * nf;

    this.isDirtyFieldOfView = false;
    this.isDirtyAspectRatio = false;
    this.isDirtyNearFar = false;
    return true;
  }

  private updateViewProjection(): boolean {
    const vm = this._viewMatrix;
    const pm = this._projectionMatrix;
    const vpm = this._viewProjectionMatrix;

    const pm00 = pm[0];
    const pm11 = pm[5];
    const pm22 = pm[10];
    const pm32 = pm[14];

    vpm[0] = pm00 * vm[0];
    vpm[1] = pm11 * vm[1];
    vpm[2] = pm22 * vm[2] + pm32 * vm[3];
    vpm[3] = -vm[2];

    vpm[4] = pm00 * vm[4];
    vpm[5] = pm11 * vm[5];
    vpm[6] = pm22 * vm[6] + pm32 * vm[7];
    vpm[7] = -vm[6];

    vpm[8] = pm00 * vm[8];
    vpm[9] = pm11 * vm[9];
    vpm[10] = pm22 * vm[10] + pm32 * vm[11];
    vpm[11] = -vm[10];

    vpm[12] = pm00 * vm[12];
    vpm[13] = pm11 * vm[13];
    vpm[14] = pm22 * vm[14] + pm32 * vm[15];
    vpm[15] = -vm[14];

    return true;
  }
}
