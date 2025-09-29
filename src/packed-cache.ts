import { getLogger } from './logging';
import { IdGetter, PackedCache } from './types';
import { BidiMap, logFuncs, Random, randomFactory, setFuncs, sliceFuncs } from './utils';

const LOGGER = getLogger('cache');

export const packedCacheFactory = {
  of: <T, TMutable extends boolean>(
    mutable: TMutable,
    idGetters: IdGetter<T>[],
    random: Random = randomFactory.ofString(new Date().toISOString()),
  ): PackedCache<T, TMutable> => {
    const idIndexes = new BidiMap<string, number>();
    const backing = new Map<string, T>();
    const added = new Map<string, T>();
    const mutated = new Map<string, T>();
    const removed = new Set<string>();
    const entityIdReferences = new Map<string, Set<string>>();
    const entityIdsReferencedBy = new Map<string, Set<string>>();
    const packedCache: PackedCache<T, false> = {
      isMutable: () => mutable,
      isDirty: () => added.size > 0 || mutated.size > 0 || removed.size > 0,
      count: () => backing.size,
      pack() {
        // entity id references
        if (idGetters.length > 0) {
          // added
          if (added.size > 0) {
            // added - new entity id references
            for (const [id, entity] of added.entries()) {
              const entityIds = idGetters
                .map(idGetter => idGetter(entity))
                .filter(entityId => !removed.has(entityId) && (added.has(entityId) || backing.has(entityId)));
              entityIdReferences.set(id, new Set(entityIds));
              entityIdsReferencedBy.set(id, new Set<string>());
            }
            // added - link new entity id references back
            for (const id of added.keys()) {
              const entityIds = entityIdReferences.get(id);
              if (entityIds === undefined) {
                throw Error(`Unable to add referenced entity ids for ${id}`);
              }
              entityIds.forEach(entityId => {
                const referencedBy = entityIdsReferencedBy.get(entityId);
                if (referencedBy === undefined) {
                  throw Error(`Unable to link referenced entity ids back for ${id} to ${entityId}`);
                }
                referencedBy.add(id);
              });
            }
          }
          // mutated
          if (mutated.size > 0) {
            // mutated - update entity indexes
            for (const [id, entity] of mutated.entries()) {
              const previousEntityIds = entityIdReferences.get(id);
              if (previousEntityIds === undefined) {
                throw Error(`Unable to check previous entity id references for ${id}`);
              }
              const newEntityIds = new Set(
                idGetters
                  .map(idGetter => idGetter(entity))
                  .filter(entityId => !removed.has(entityId) && (added.has(entityId) || backing.has(entityId)))
              );
              if (setFuncs.equals(previousEntityIds, newEntityIds)) {
                logFuncs.lazyDebug(LOGGER, () => `Entity ids for ${id} are the same`);
              } else {
                entityIdReferences.set(id, newEntityIds);
                // mutated - remove previous links
                previousEntityIds.forEach(previousEntityId => {
                  if (!newEntityIds.has(previousEntityId)) {
                    const previousReferencedBy = entityIdsReferencedBy.get(previousEntityId);
                    if (previousReferencedBy === undefined) {
                      throw Error(`Unable to remove previous entity id reference for ${id} to ${previousEntityId}`);
                    } else {
                      previousReferencedBy.delete(id);
                    }
                  }
                });
                // mutated - add new links
                newEntityIds.forEach(newEntityId => {
                  if (!previousEntityIds.has(newEntityId)) {
                    const newReferencedBy = entityIdsReferencedBy.get(newEntityId);
                    if (newReferencedBy === undefined) {
                      throw Error(`Unable to add new entity id reference for ${id} to ${newEntityId}`);
                    } else {
                      newReferencedBy.add(id);
                    }
                  }
                });
              }
            }
          }
          // removed
          if (removed.size > 0) {
            // remove - gather all entity ids that used to reference any removed entity
            const entityIdsReferencingRemoved = new Set<string>();
            for (const id of removed.values()) {
              const referencedBy = entityIdsReferencedBy.get(id);
              if (referencedBy === undefined) {
                throw Error(`Unable to mutate entities referencing entity ${id}`);
              } else {
                referencedBy.forEach(entityId => entityIdsReferencingRemoved.add(entityId));
              }
            }
            // remove - ensure all entities that used to reference a removed entity are mutated to update their entity indexes
            for (const mutatedId of entityIdsReferencingRemoved) {
              if (!mutated.has(mutatedId)) {
                const entityReferencingRemoved = backing.get(mutatedId);
                if (entityReferencingRemoved === undefined) {
                  throw Error(`Unable to update entity ${mutatedId} that used to reference a removed entity`);
                } else {
                  mutated.set(mutatedId, entityReferencingRemoved);
                }
              }
            }
            // remove - delete links from referencing entities to removed, and from removed to referenced entities
            for (const id of removed.values()) {
              const references = entityIdReferences.get(id);
              const referencedBy = entityIdsReferencedBy.get(id);
              if (references === undefined) {
                throw Error(`Unable to remove entity id references from ${id}`);
              }
              if (referencedBy === undefined) {
                throw Error(`Unable to remove entity id references to ${id}`);
              }
              references.forEach(entityIdTo => {
                const referencedBy = entityIdsReferencedBy.get(entityIdTo);
                if (referencedBy === undefined) {
                  throw Error(`Unable to remove entity id references from ${id} to ${entityIdTo}`);
                } else {
                  referencedBy.delete(id);
                }
              });
              referencedBy.forEach(entityIdFrom => {
                const references = entityIdReferences.get(entityIdFrom);
                if (references === undefined) {
                  throw Error(`Unable to remove entity id references from ${entityIdFrom} to ${id}`);
                } else {
                  references.delete(id);
                }
              });
              // remove - delete references to and from removed entities
              entityIdReferences.delete(id);
              entityIdsReferencedBy.delete(id);
            }
          }
        }

        const previousUsedCount = backing.size;
        const newUsedCount = previousUsedCount + added.size - removed.size;

        const changing = new Map<string, number>();
        const addedArray = [...added];
        const removedArray = [...removed];
        const replaceCount = Math.min(addedArray.length, removedArray.length);

        // replacing
        for (let i = 0; i < replaceCount; i++) {
          const addedId = addedArray[i][0];
          const removedId = removedArray[i];
          const replacedIndex = idIndexes.get(removedId);
          if (replacedIndex === undefined) {
            throw Error(`Unable to replace ${removedId} with ${addedId}`);
          } else {
            changing.set(addedId, replacedIndex);
          }
        }
        // appending
        if (addedArray.length > replaceCount) {
          for (let i = replaceCount; i < addedArray.length; i++) {
            const addedId = addedArray[i][0];
            changing.set(addedId, previousUsedCount - replaceCount + i);
          }
        }
        // moving
        if (removedArray.length > replaceCount) {
          const replacedIndexes = removedArray
            .slice(replaceCount)
            .map(id => idIndexes.get(id))
            .filter(index => index !== undefined)
            .filter((index) => index < newUsedCount);
          let movedIndex = previousUsedCount;
          for (const replacedIndex of replacedIndexes) {
            movedIndex--;
            while (movedIndex > newUsedCount && replacedIndexes.includes(movedIndex)) {
              movedIndex--;
            }
            if (movedIndex > replacedIndex) {
              const movedId = idIndexes.getKey(movedIndex);
              if (movedId === undefined) {
                throw Error(`Unable to replace with index ${movedIndex} no id found`);
              } else {
                logFuncs.lazyDebug(LOGGER, () => `Replacing entity at index ${replacedIndex} with ${movedId} moved from index ${movedIndex}`);
                changing.set(movedId, replacedIndex);
                if (idGetters.length > 0) {
                  const referencedBy = entityIdsReferencedBy.get(movedId);
                  if (referencedBy === undefined) {
                    throw Error(`Unable to update entity references to ${movedId} no references found`);
                  } else {
                    for (const referencingId of referencedBy) {
                      const referencingInstance = backing.get(referencingId);
                      if (referencingInstance === undefined) {
                        throw Error(`Unable to update referencing entity ${referencingId} no instance found`);
                      } else {
                        logFuncs.lazyDebug(LOGGER, () => `Ensuring entity referencing entity ${referencingId} is updated`);
                        mutated.set(referencingId, referencingInstance);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // update backing
        added.forEach((instance, id) => backing.set(id, instance));
        mutated.forEach((instance, id) => backing.set(id, instance));
        removed.forEach((id) => backing.delete(id));

        // combine indexes and instances, overwrite mutated indexes
        const changed = new Map<string, [T, number]>();
        // mutated
        for (const [id, instance] of mutated) {
          const index = idIndexes.get(id);
          if (index === undefined) {
            throw Error(`Unable to mutate entity ${id}`);
          } else {
            changed.set(id, [instance, index]);
          }
        }
        // changing
        for (const [id, index] of changing) {
          const instance = mutated.get(id) || added.get(id) || backing.get(id);
          if (instance === undefined) {
            throw Error(`Unable to find instance for id ${id}`);
          }
          changed.set(id, [instance, index]);
        }
        const command = sliceFuncs.ofMap(changed, ([, index]) => index, ([instance]) => instance);

        // update id indexes
        for (const removedId of removedArray) {
          idIndexes.delete(removedId);
        }
        for (const [id, [, index]] of changed) {
          idIndexes.set(id, index, true);
        }

        // clear temp storage to prepare for next iteration
        added.clear();
        removed.clear();
        mutated.clear();
        logFuncs.lazyDebug(LOGGER, () => `Calculated entity cache changes ${JSON.stringify(command)}`);
        return command;
      },
      add(entity) {
        const id = random.uuidV4Like();
        logFuncs.lazyDebug(LOGGER, () => `Add element with id ${id}`);
        added.set(id, entity);
        return id;
      },
      remove(id) {
        logFuncs.lazyDebug(LOGGER, () => `Remove element with id ${id}`);
        if (backing.has(id)) {
          mutated.delete(id);
          removed.add(id);
        } else if (added.has(id)) {
          added.delete(id);
        } else {
          throw Error(`Cannot remove element ${id} before it has been added`);
        }
      },
      idOf(index) {
        return idIndexes.getKey(index);
      },
      indexOf(id) {
        const index = idIndexes.get(id);
        const validIndex = (index === undefined)
          ? -1
          : index;
        logFuncs.lazyDebug(LOGGER, () => `Index of id ${id} is ${validIndex}`);
        return validIndex;
      },
    };
    if (mutable) {
      logFuncs.lazyDebug(LOGGER, () => 'Making packed cache mutable');
      const typedCache = packedCache as PackedCache<T, true>;
      typedCache.mutate = (id, instance) => {
        logFuncs.lazyDebug(LOGGER, () => `Mutating instance with id ${id}`);
        if (removed.has(id)) {
          throw Error(`Cannot mutate instance ${id} after it has been removed`);
        } else {
          if (backing.has(id)) {
            mutated.set(id, instance);
          } else if (added.has(id)) {
            added.set(id, instance);
          } else {
            throw Error(`Cannot mutate instance ${id} before it is added`);
          }
        }
      };
    }
    return packedCache as PackedCache<T, TMutable>;
  },
};
