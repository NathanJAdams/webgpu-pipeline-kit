import { logFactory } from './logging';
import { Vector3 } from './math';
import { WPKIndices, WPKMesh, WPKMeshParametersDeclaration, WPKMeshTemplateCreator, WPKVertices } from './types';
import { logFuncs, mathFuncs } from './utils';

const LOGGER = logFactory.getLogger('mesh');

export const meshFuncs = {
  UINT32_INDEX_COUNT: 1 << 16,
  VERTICES_PER_TRIANGLE: 3,

  cullMode: (mesh: WPKMesh): GPUCullMode => (mesh.winding === 'cw')
    ? 'front'
    : 'back',
  indicesType: (mesh: WPKMesh): GPUIndexFormat => (mesh.indices.length < meshFuncs.UINT32_INDEX_COUNT)
    ? 'uint16'
    : 'uint32',
  indicesCount: (mesh: WPKMesh): number => mesh.indices.length * 3,
  indicesBytesLength: (mesh: WPKMesh): number => {
    const indicesCount = meshFuncs.indicesCount(mesh);
    return (indicesCount < meshFuncs.UINT32_INDEX_COUNT)
      ? indicesCount * 2
      : indicesCount * 4;
  },
  toIndicesData: (mesh: WPKMesh): ArrayBuffer => {
    const indicesType = meshFuncs.indicesType(mesh);
    const flatIndices = mesh.indices.flatMap(indices => indices.toArray());
    const TypedArrayConstructor = (indicesType === 'uint16')
      ? Uint16Array
      : Uint32Array;
    const typedArray = new TypedArrayConstructor(flatIndices);
    const byteLength = typedArray.byteLength;
    if (byteLength % 4 === 0) {
      return typedArray.buffer;
    }
    const paddedByteLength = mathFuncs.nextMultipleOf(byteLength, 4);
    const buffer = new ArrayBuffer(paddedByteLength);
    const targetView = new TypedArrayConstructor(buffer);
    targetView.set(typedArray);
    return buffer;
  },
  toVerticesData: (mesh: WPKMesh): ArrayBuffer => {
    const flatVertices = mesh.vertices.flatMap(indices => indices.toArray());
    const verticesArray = new Float32Array(flatVertices);
    return verticesArray.buffer;
  },
};

export const meshTemplateFactory = {
  of: <TParameters extends WPKMeshParametersDeclaration>(parameters: TParameters, toMesh: WPKMeshTemplateCreator<TParameters>) => ({
    parameters,
    toMesh,
  }),
};

export const meshFactory = {
  of: (type: GPUPrimitiveTopology, vertices: WPKVertices, indices: WPKIndices, winding: GPUFrontFace): WPKMesh => {
    return {
      topology: type,
      vertices,
      indices,
      winding,
    };
  },
  triangle: (topProportion: number, axis: Vector3 = Vector3.Z): WPKMesh => {
    logFuncs.lazyDebug(LOGGER, () => `Creating triangle mesh with top proportion ${topProportion}`);
    const axisNormalized = axis.normalize();

    // Pick a non-parallel reference vector for tangent
    const up: Vector3 = Math.abs(axisNormalized.y) < 0.99 ? Vector3.Y : Vector3.X;
    const tangent = up.cross(axisNormalized).normalize();
    const bitangent = axisNormalized.cross(tangent); // already normalized due to orthogonality

    // Define triangle in 2D: base at y = -1, top at y = 1
    const baseY = -1;
    const topY = 1;
    const leftX = -1;
    const rightX = 1;
    const topX = leftX + (rightX - leftX) * topProportion;

    const localPoints: [number, number][] = [
      [leftX, baseY],
      [rightX, baseY],
      [topX, topY],
    ];

    // Project into 3D using tangent/bitangent vectors
    const vertices: WPKVertices = [];
    for (const [x, y] of localPoints) {
      const vx = tangent.x * x + bitangent.x * y;
      const vy = tangent.y * x + bitangent.y * y;
      const vz = tangent.z * x + bitangent.z * y;
      vertices.push(new Vector3(vx, vy, vz));
    }

    const indices: WPKIndices = [new Vector3(0, 1, 2)];
    return {
      topology: 'triangle-list',
      vertices,
      indices,
      winding: 'cw',
    };
  },
  cube: (): WPKMesh => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating cube mesh');
    const vertices: Vector3[] = [
      // Front face
      new Vector3(-1, -1, 1), // front bottom left
      new Vector3(1, -1, 1), // front bottom right
      new Vector3(1, 1, 1), // front top right
      new Vector3(-1, 1, 1), // front top left
      // Back face
      new Vector3(-1, -1, -1), // back bottom left
      new Vector3(-1, 1, -1), // back top left
      new Vector3(1, 1, -1), // back top right
      new Vector3(1, -1, -1), // back bottom right
    ];
    const indices: Vector3[] = [
      // Front
      new Vector3(0, 1, 2),
      new Vector3(0, 2, 3),
      // Top
      new Vector3(3, 2, 6),
      new Vector3(3, 6, 5),
      // Back
      new Vector3(5, 6, 7),
      new Vector3(5, 7, 4),
      // Bottom
      new Vector3(4, 7, 1),
      new Vector3(4, 1, 0),
      // Left
      new Vector3(4, 0, 3),
      new Vector3(4, 3, 5),
      // Right
      new Vector3(1, 7, 6),
      new Vector3(1, 6, 2),
    ];
    return {
      topology: 'triangle-list',
      vertices,
      indices,
      winding: 'cw',
    };
  },
  sphere(subdivisions: number): WPKMesh {
    logFuncs.lazyDebug(LOGGER, () => `Creating sphere mesh with sub divisions ${subdivisions}`);
    const phi = (1 + Math.sqrt(5)) / 2;
    const unnormalizedVertices: Vector3[] = [
      new Vector3(-1, phi, 0),
      new Vector3(1, phi, 0),
      new Vector3(-1, -phi, 0),
      new Vector3(1, -phi, 0),
      new Vector3(0, -1, phi),
      new Vector3(0, 1, phi),
      new Vector3(0, -1, -phi),
      new Vector3(0, 1, -phi),
      new Vector3(phi, 0, -1),
      new Vector3(phi, 0, 1),
      new Vector3(-phi, 0, -1),
      new Vector3(-phi, 0, 1),
    ];
    const vertices = unnormalizedVertices.map(vec => vec.normalize());
    const baseIndices: Vector3[] = [
      new Vector3(0, 11, 5),
      new Vector3(0, 5, 1),
      new Vector3(0, 1, 7),
      new Vector3(0, 7, 10),
      new Vector3(0, 10, 11),
      new Vector3(1, 5, 9),
      new Vector3(5, 11, 4),
      new Vector3(11, 10, 2),
      new Vector3(10, 7, 6),
      new Vector3(7, 1, 8),
      new Vector3(3, 9, 4),
      new Vector3(3, 4, 2),
      new Vector3(3, 2, 6),
      new Vector3(3, 6, 8),
      new Vector3(3, 8, 9),
      new Vector3(4, 9, 5),
      new Vector3(2, 4, 11),
      new Vector3(6, 2, 10),
      new Vector3(8, 6, 7),
      new Vector3(9, 8, 1),
    ];
    const indices: Vector3[] = [];
    const cache = new Map<string, number>();

    const getOrCreateMidpoint = (a: number, b: number): number => {
      const key = [Math.min(a, b), Math.max(a, b)].join('|');
      if (cache.has(key)) {
        return cache.get(key) as number;
      }
      const midpoint = vertices[a].midpoint(vertices[b]);
      const index = vertices.length;
      vertices.push(midpoint);
      cache.set(key, index);
      return index;
    };

    const subdivide = (a: number, b: number, c: number, depth: number) => {
      if (depth === 0) {
        indices.push(new Vector3(a, b, c));
      } else {
        const ab = getOrCreateMidpoint(a, b);
        const bc = getOrCreateMidpoint(b, c);
        const ca = getOrCreateMidpoint(c, a);
        subdivide(a, ab, ca, depth - 1);
        subdivide(b, bc, ab, depth - 1);
        subdivide(c, ca, bc, depth - 1);
        subdivide(ab, bc, ca, depth - 1);
      }
    };

    for (const vec of baseIndices) {
      subdivide(vec.x, vec.y, vec.z, subdivisions);
    }

    return {
      topology: 'triangle-list',
      vertices,
      indices,
      winding: 'cw',
    };
  }
};
