import { factories } from 'webgpu-pipeline-kit';

import { Entity, entityFormat, Uniform, uniformFormat } from './instance-formats';

export const uniform: Uniform = {
  gameTime: 123,
};
export const entity: Entity = {
  exampleObject: {
    a: 1,
    b: [12, 34],
    c: {
      nested: {
        x: 5,
        y: 6,
        z: 7,
      },
    },
  },
  exampleTuple: [111, true, 'hello'],
};
const mutatedEntity: Entity = {
  ...entity,
  exampleTuple: [222, false, 'goodbye'],
};

export const uniformCache = factories.cache.ofUniform(uniformFormat, uniform, false);
export const entityCacheFixedSize = factories.cache.ofEntitiesFixedSize(entityFormat, true, entity, mutatedEntity);
export const entityCacheResizeable = factories.cache.ofEntitiesResizeable(entityFormat, true);

const entityId = entityCacheResizeable.add(entity);
entityCacheFixedSize.mutate(0, mutatedEntity);
entityCacheResizeable.mutate(entityId, mutatedEntity);
