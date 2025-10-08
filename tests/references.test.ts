import { packedCacheFactory } from '../src/packed-cache';

type Example = {
  ref: string;
};

const createCache = () => packedCacheFactory.of<Example, true>(true, [e => e.ref]);

describe('references', () => {
  describe('entity is changed', () => {
    test('when referencing a removed entity', () => {
      const cache = createCache();
      const example0: Example = { ref: '' };
      const example1: Example = { ref: '' };
      const id0 = cache.add(example0);
      const id1 = cache.add(example1);
      const example0Mutated: Example = { ref: id1 };
      cache.mutate(id0, example0Mutated);
      cache.pack();
      cache.remove(id1);
      const changes = cache.pack();
      expect(changes.copySlices.length).toBe(1);
      expect(changes.copySlices[0].length).toBe(1);
      expect(changes.copySlices[0].min).toBe(0);
      expect(changes.copySlices[0].toIndex).toBe(0);
      expect(changes.values.length).toBe(1);
      expect(changes.values[0].ref).toBe(example0Mutated.ref);
    });
    test('when changing a reference', () => {
      const cache = createCache();
      const example0: Example = { ref: '' };
      const example1: Example = { ref: '' };
      const example2: Example = { ref: '' };
      const id0 = cache.add(example0);
      const id1 = cache.add(example1);
      const id2 = cache.add(example2);
      const example0Mutated1: Example = { ref: id1 };
      cache.mutate(id0, example0Mutated1);
      cache.pack();
      const example0Mutated2: Example = { ref: id2 };
      cache.mutate(id0, example0Mutated2);
      const changes = cache.pack();
      expect(changes.copySlices.length).toBe(1);
      expect(changes.copySlices[0].length).toBe(1);
      expect(changes.copySlices[0].min).toBe(0);
      expect(changes.copySlices[0].toIndex).toBe(0);
      expect(changes.values.length).toBe(1);
      expect(changes.values[0].ref).toBe(example0Mutated2.ref);
    });
  });
  describe('entity is not changed', () => {
    test('when referencing a mutated entity', () => {
      const cache = createCache();
      const example0: Example = { ref: '' };
      const id0 = cache.add(example0);
      const example1: Example = { ref: id0 };
      const id1 = cache.add(example1);
      cache.pack();
      const example0Mutated: Example = { ref: 'abc' };
      cache.mutate(id0, example0Mutated);
      const changes = cache.pack();
      expect(changes.copySlices.length).toBe(1);
      expect(changes.copySlices[0].length).toBe(1);
      expect(changes.copySlices[0].min).toBe(0);
      expect(changes.copySlices[0].toIndex).toBe(0);
      expect(changes.values.length).toBe(1);
      expect(changes.values[0].ref).toBe(example0Mutated.ref);
    });
    test('when referencing a different entity', () => {
      const cache = createCache();
      const example0: Example = { ref: '' };
      const example1: Example = { ref: '' };
      const id0 = cache.add(example0);
      const id1 = cache.add(example1);
      const example2: Example = { ref: id0 };
      const id2 = cache.add(example2);
      cache.pack();
      cache.mutate(id2, { ref: id1 });
      cache.pack();
      const example0Mutated: Example = { ref: 'abc' };
      cache.mutate(id0, example0Mutated);
      const changes = cache.pack();
      expect(changes.copySlices.length).toBe(1);
      expect(changes.copySlices[0].length).toBe(1);
      expect(changes.copySlices[0].min).toBe(0);
      expect(changes.copySlices[0].toIndex).toBe(0);
      expect(changes.values.length).toBe(1);
      expect(changes.values[0].ref).toBe(example0Mutated.ref);
    });
  });
});
