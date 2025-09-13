import { Quaternion } from './Quaternion';
import { Vector3 } from './Vector3';

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
  private _viewMatrix: Float32Array = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
  private _projectionMatrix: Float32Array = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, -1,
    0, 0, 0, 0,
  ]);
  private _viewProjectionMatrix: Float32Array = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);

  constructor(
    private readonly enableViewProjectionMatrix: boolean
  ) { }

  get viewMatrix(): Readonly<Float32Array> {
    return this._viewMatrix;
  }
  get projectionMatrix(): Readonly<Float32Array> {
    return this._projectionMatrix;
  }
  get viewProjectionMatrix(): Readonly<Float32Array> {
    if (!this.enableViewProjectionMatrix) {
      throw Error('The `enableViewProjectionMatrix` flag in the constructor must be `true` to allow using it');
    }
    return this._viewProjectionMatrix;
  }

  set position(position: Vector3) {
    this.isDirtyPosition = true;
    this._position = position;
  }
  set rotation(rotation: Quaternion) {
    this.isDirtyRotation = true;
    this._rotation = rotation;
  }
  set fieldOfView(fieldOfView: number) {
    if (fieldOfView <= 0 || fieldOfView >= 180) {
      throw new Error(`FOV must be between 0 and 180 degrees but is ${fieldOfView}`);
    }
    this.isDirtyFieldOfView = true;
    this._fieldOfViewDegrees = fieldOfView;
  }
  set aspectRatio(aspectRatio: number) {
    this.isDirtyAspectRatio = true;
    this._aspectRatio = aspectRatio;
  }
  set nearFar(nearFar: [number, number]) {
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
    this.position = this.position.plus(offset);
  }

  rotate(rotation: Quaternion): void {
    this.rotation = this.rotation.multiply(rotation).normalize();
  }

  flushChanges(): void {
    const vm = this._viewMatrix;
    if (this.isDirtyPosition || this.isDirtyRotation) {
      const { x: px, y: py, z: pz } = this._position;
      const { x: qx, y: qy, z: qz, w: qw } = this._rotation;
      const qxSq = qx ** 2;
      const qySq = qy ** 2;
      const qzSq = qz ** 2;
      const qx_qy = qx * qy;
      const qx_qz = qx * qz;
      const qx_qw = qx * qw;
      const qy_qz = qy * qz;
      const qy_qw = qy * qw;
      const qz_qw = qz * qw;
      const m00 = 1 - 2 * (qySq + qzSq);
      const m01 = 2 * (qx_qy + qz_qw);
      const m02 = 2 * (qx_qz - qy_qw);
      const m10 = 2 * (qx_qy - qz_qw);
      const m11 = 1 - 2 * (qxSq + qzSq);
      const m12 = 2 * (qy_qz + qx_qw);
      const m20 = 2 * (qx_qz + qy_qw);
      const m21 = 2 * (qy_qz - qx_qw);
      const m22 = 1 - 2 * (qxSq + qySq);
      vm[0] = m00;
      vm[1] = m10;
      vm[2] = m20;
      // m[3] = 0;
      vm[4] = m01;
      vm[5] = m11;
      vm[6] = m21;
      // m[7] = 0;
      vm[8] = m02;
      vm[9] = m12;
      vm[10] = m22;
      // m[11] = 0;
      vm[12] = -(m00 * px + m01 * py + m02 * pz);
      vm[13] = -(m10 * px + m11 * py + m12 * pz);
      vm[14] = -(m20 * px + m21 * py + m22 * pz);
      // m[15] = 1;
      this.isDirtyPosition = false;
      this.isDirtyRotation = false;
    }
    const pm = this._projectionMatrix;
    if (this.isDirtyAspectRatio || this.isDirtyFieldOfView) {
      const fovRadians = (this._fieldOfViewDegrees * Math.PI) / 180;
      const f = 1 / Math.tan(fovRadians / 2);
      pm[0] = f / this._aspectRatio;
      // m[1] = 0;
      // m[2] = 0;
      // m[3] = 0;
      // m[4] = 0;
      pm[5] = f;
      // m[6] = 0;
      // m[7] = 0;
      this.isDirtyAspectRatio = false;
      this.isDirtyFieldOfView = false;
    }
    if (this.isDirtyNearFar) {
      const [near, far] = this._nearFar;
      const reciprocalNegativeRange = 1 / (near - far);
      // m[8] = 0;
      // m[9] = 0;
      pm[10] = (far + near) * reciprocalNegativeRange;
      // m[11] = -1;
      // m[12] = 0;
      // m[13] = 0;
      pm[14] = 2 * far * near * reciprocalNegativeRange;
      // m[15] = 0;
      this.isDirtyNearFar = false;
    }
    if (this.enableViewProjectionMatrix) {
      const vpm = this._viewProjectionMatrix;
      const pm0 = pm[0];
      const pm5 = pm[5];
      const pm10 = pm[10];
      const pm14 = pm[14];
      const vm8 = vm[8];
      const vm9 = vm[9];
      const vm10 = vm[10];
      const vm11 = vm[11];
      vpm[0] = pm0 * vm[0];
      vpm[1] = pm0 * vm[1];
      vpm[2] = pm0 * vm[2];
      vpm[3] = pm0 * vm[3];
      vpm[4] = pm5 * vm[4];
      vpm[5] = pm5 * vm[5];
      vpm[6] = pm5 * vm[6];
      vpm[7] = pm5 * vm[7];
      vpm[8] = pm10 * vm8 + pm14 * vm[12];
      vpm[9] = pm10 * vm9 + pm14 * vm[13];
      vpm[10] = pm10 * vm10 + pm14 * vm[14];
      vpm[11] = pm10 * vm11 + pm14 * vm[15];
      vpm[12] = -vm8;
      vpm[13] = -vm9;
      vpm[14] = -vm10;
      vpm[15] = -vm11;
    }
  }
}
