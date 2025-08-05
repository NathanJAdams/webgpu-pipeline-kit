import { getLogger, lazyDebug } from './logging';
import { mathFuncs, Vec3, vec3Funcs } from './utils';

export type WPKVertices = Vec3[];
export type WPKIndices = Vec3[];

export type WPKMesh = {
  vertices: WPKVertices;
  indices: WPKIndices;
  topology: GPUPrimitiveTopology;
  winding: GPUFrontFace;
};

const LOGGER = getLogger('mesh');

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
    const flatIndices = mesh.indices.flat();
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
    const flatVertices = mesh.vertices.flat();
    const verticesArray = new Float32Array(flatVertices);
    return verticesArray.buffer;
  },
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
  triangle: (topProportion: number, axis: Vec3 = vec3Funcs.Z): WPKMesh => {
    lazyDebug(LOGGER, () => `Creating triangle mesh with top proportion ${topProportion}`);
    const axisNormalized = vec3Funcs.normalize(axis);

    // Pick a non-parallel reference vector for tangent
    const up: Vec3 = Math.abs(axisNormalized[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
    const tangent = vec3Funcs.normalize(vec3Funcs.cross(up, axisNormalized));
    const bitangent = vec3Funcs.cross(axisNormalized, tangent); // already normalized due to orthogonality

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
      const vx = tangent[0] * x + bitangent[0] * y;
      const vy = tangent[1] * x + bitangent[1] * y;
      const vz = tangent[2] * x + bitangent[2] * y;
      vertices.push([vx, vy, vz]);
    }

    const indices: WPKIndices = [[0, 1, 2]];
    return {
      topology: 'triangle-list',
      vertices,
      indices,
      winding: 'cw',
    };
  },
  cube: (): WPKMesh => {
    lazyDebug(LOGGER, () => 'Creating cube mesh');
    const vertices: Vec3[] = [
      // Front face
      [-1, -1, 1], // front bottom left
      [1, -1, 1], // front bottom right
      [1, 1, 1], // front top right
      [-1, 1, 1], // front top left
      // Back face
      [-1, -1, -1], // back bottom left
      [-1, 1, -1], // back top left
      [1, 1, -1], // back top right
      [1, -1, -1], // back bottom right
    ];
    const indices: Vec3[] = [
      // Front
      [0, 1, 2],
      [0, 2, 3],
      // Top
      [3, 2, 6],
      [3, 6, 5],
      // Back
      [5, 6, 7],
      [5, 7, 4],
      // Bottom
      [4, 7, 1],
      [4, 1, 0],
      // Left
      [4, 0, 3],
      [4, 3, 5],
      // Right
      [1, 7, 6],
      [1, 6, 2],
    ];
    return {
      topology: 'triangle-list',
      vertices,
      indices,
      winding: 'cw',
    };
  },
  sphere(subdivisions: number): WPKMesh {
    lazyDebug(LOGGER, () => `Creating sphere mesh with sub divisions ${subdivisions}`);
    const phi = (1 + Math.sqrt(5)) / 2;
    const unnormalizedVertices: Vec3[] = [
      [-1, phi, 0],
      [1, phi, 0],
      [-1, -phi, 0],
      [1, -phi, 0],
      [0, -1, phi],
      [0, 1, phi],
      [0, -1, -phi],
      [0, 1, -phi],
      [phi, 0, -1],
      [phi, 0, 1],
      [-phi, 0, -1],
      [-phi, 0, 1],
    ];
    const vertices = unnormalizedVertices.map(vec3Funcs.normalize);
    const baseIndices: Vec3[] = [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ];
    const indices: Vec3[] = [];
    const cache = new Map<string, number>();

    const getOrCreateMidpoint = (a: number, b: number): number => {
      const key = [Math.min(a, b), Math.max(a, b)].join('|');
      if (cache.has(key)) {
        return cache.get(key) as number;
      }
      const midpoint = vec3Funcs.midpoint(vertices[a], vertices[b]);
      const index = vertices.length;
      vertices.push(midpoint);
      cache.set(key, index);
      return index;
    };

    const subdivide = (a: number, b: number, c: number, depth: number) => {
      if (depth === 0) {
        indices.push([a, b, c]);
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

    for (const [a, b, c] of baseIndices) {
      subdivide(a, b, c, subdivisions);
    }

    return {
      topology: 'triangle-list',
      vertices,
      indices,
      winding: 'cw',
    };
  }
};
