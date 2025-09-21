import { builders } from '../..';
import { OrbiterBufferFormats } from './buffer-formats';
import { Orbiter, OrbiterUniform } from './instance-formats';
import { OrbiterMeshTemplates } from './mesh-templates';

const computeGroupBindings = builders.computeGroupBindings<OrbiterUniform, Orbiter, OrbiterBufferFormats>()
  .pushObject().group(0).binding(0).buffer('uniforms').buildElement()
  .pushObject().group(1).binding(0).buffer('kepler').buildElement()
  .pushObject().group(2).binding(0).buffer('position').buildElement()
  .buildArray();

const computeShader = builders.computeShader<OrbiterUniform, Orbiter, OrbiterBufferFormats>()
  .groupBindings(computeGroupBindings)
  .prologue(
    `fn calculateEccentricAnomaly(meanAnomalyAtTime: f32, eccentricity: f32) -> f32 {
  const minEccentricity = 0.001;
  const maxIterations = 5u;
  const tolerance = 0.00001;

  if (eccentricity <= minEccentricity) {
    // No further calculation needed
    return meanAnomalyAtTime;
  } else if (eccentricity <= 0.3) {
    // Taylor series approximation
    return meanAnomalyAtTime
      + (eccentricity * sin(meanAnomalyAtTime))
      + (0.5 * eccentricity * eccentricity * sin(2.0 * meanAnomalyAtTime));
  } else {
    // Kepler's equation
    var eccentricAnomaly = meanAnomalyAtTime;
    for (var i = 0u; i < maxIterations; i = i + 1u) {
      let numerator = eccentricAnomaly - (eccentricity * sin(eccentricAnomaly)) - meanAnomalyAtTime;
      let denominator = 1 - eccentricity * cos(eccentricAnomaly);
      let delta = numerator / denominator;
      if (abs(delta) < tolerance) {
        return eccentricAnomaly;
      }
      eccentricAnomaly -= delta;
    }
    return eccentricAnomaly;
  }
}`
  )
  .passesArray()
  .pushObject()
  .workGroupSize({ x: 64 })
  .entryPoint('orbiter_kepler')
  .code((wgsl, params) => wgsl`
  if (${params.bindings.kepler.primaryIndex} == -1) {
    return;
  }

  let semiMajorAxis = ${params.bindings.kepler.semiMajorAxis};
  let eccentricity = ${params.bindings.kepler.eccentricity};
  let meanAnomaly = ${params.bindings.kepler.meanAnomaly};
  let meanMotion = ${params.bindings.kepler.meanMotion};
  let sqrt_OnePlusEccentricityOverOneMinusEccentricity = ${params.bindings.kepler.sqrt_OnePlusEccentricityOverOneMinusEccentricity};
  let cosInclination = ${params.bindings.kepler.inclination.x};
  let sinInclination = ${params.bindings.kepler.inclination.y};
  let cosArgumentOfPeriapsis = ${params.bindings.kepler.argumentOfPeriapsis.x};
  let sinArgumentOfPeriapsis = ${params.bindings.kepler.argumentOfPeriapsis.y};
  let cosLongitudeOfAscendingNode = ${params.bindings.kepler.longitudeOfAscendingNode.x};
  let sinLongitudeOfAscendingNode = ${params.bindings.kepler.longitudeOfAscendingNode.y};

  let meanAnomalyAtTime = meanAnomaly + meanMotion * ${params.bindings.uniforms.gameTime};
  let eccentricAnomaly = calculateEccentricAnomaly(meanAnomalyAtTime, eccentricity);

  // true anomaly and orbital radius
  let halfEccentricAnomaly = eccentricAnomaly * 0.5;
  let trueAnomaly = 2 * atan2(
    sqrt_OnePlusEccentricityOverOneMinusEccentricity * sin(halfEccentricAnomaly),
    cos(halfEccentricAnomaly)
  );
  let cosTrueAnomaly = cos(trueAnomaly);
  let orbitalRadius = (semiMajorAxis * (1 - (eccentricity * eccentricity))) / (1 + eccentricity * cosTrueAnomaly);

  // position in orbital plane
  let xOrbit = orbitalRadius * cosTrueAnomaly;
  let zOrbit = orbitalRadius * sin(trueAnomaly);

  // Apply argument of periapsis rotation
  let xRotated = xOrbit * cosArgumentOfPeriapsis - zOrbit * sinArgumentOfPeriapsis;
  let zRotated = xOrbit * sinArgumentOfPeriapsis + zOrbit * cosArgumentOfPeriapsis;

  // Apply inclination rotation
  let xInclined = xRotated;
  let yInclined = zRotated * sinInclination;
  let zInclined = zRotated * cosInclination;

  // Apply longitude of ascending node rotation
  let xRelative = xInclined * cosLongitudeOfAscendingNode - yInclined * sinLongitudeOfAscendingNode;
  let yRelative = xInclined * sinLongitudeOfAscendingNode + yInclined * cosLongitudeOfAscendingNode;
  let zRelative = zInclined;

  // Write out orbiter position
  ${params.bindings.position.position} = ${params.bindings.position.atIndex(params.bindings.kepler.primaryIndex).position} + vec3<f32>(xRelative, yRelative, zRelative);
  `)
  .build()
  .buildPasses()
  .buildObject();

const meshTemplate = builders.meshTemplate<OrbiterMeshTemplates>()
  .key('sphere')
  .parametersObject()
  .subdivisions(3)
  .buildParameters()
  .buildObject();

const vertexShader = builders.vertexShader<OrbiterUniform, Orbiter, OrbiterBufferFormats>()
  .entryPoint('orbiter_vertex')
  .returnType('builtin_position')
  .vertexBuffersArray()
  .pushObject().buffer('position').field('position').buildElement()
  .pushObject().buffer('visual').field('color').buildElement()
  .pushObject().buffer('visual').field('radius').buildElement()
  .buildVertexBuffers()
  .code((wgsl, params) => wgsl`
  let model_position = ${params.vertex_buffers.position.position} + (${params.vertex_position} * visual_radius);
  return ${params.bindings.uniforms.camera} * vec4<f32>(model_position, 1.0);
`)
  .buildObject();

const fragmentShader = builders.fragmentShader<OrbiterUniform, Orbiter, OrbiterBufferFormats>()
  .entryPoint('orbiter_fragment')
  .code((wgsl, _params) => wgsl`  return vec4<f32>(0.9, 0.7, 0.5, 1.0);`)
  .buildObject();

const renderGroupBindings = builders.renderGroupBindings<OrbiterUniform, Orbiter, OrbiterBufferFormats>()
  .pushObject().group(0).binding(0).buffer('uniforms').buildElement()
  .buildArray();

const renderShader = builders.renderShader<OrbiterUniform, Orbiter, OrbiterBufferFormats, OrbiterMeshTemplates>()
  .groupBindings(renderGroupBindings)
  .passesArray()
  .pushObject()
  .mesh(meshTemplate)
  .vertex(vertexShader)
  .fragment(fragmentShader)
  .buildElement()
  .buildPasses()
  .buildObject();

export const orbiterShader = builders.shader<OrbiterUniform, Orbiter, OrbiterBufferFormats, OrbiterMeshTemplates>()
  .compute(computeShader)
  .render(renderShader)
  .buildObject();
