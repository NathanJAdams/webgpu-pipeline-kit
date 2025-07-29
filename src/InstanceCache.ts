import { v4 as uuid } from 'uuid';

export type WGBKInstanceCommand<T> = {
    added: Map<string, T>;
    mutated: Map<string, T>;
    removed: Set<string>;
};

export class WGBKInstanceCache<T> {
  private readonly backing = new Map<string, T>();
  private readonly currentCommand: WGBKInstanceCommand<T> = {
    added: new Map(),
    mutated: new Map(),
    removed: new Set(),
  };

  count(): number {
    return this.backing.size;
  }
  isDirty(): boolean {
    const { added, mutated, removed } = this.currentCommand;
    return added.size > 0 || mutated.size > 0 || removed.size > 0;
  }
  add(instance: T): string {
    const id = uuid();
    this.currentCommand.added.set(id, instance);
    return id;
  }
  mutate(id: string, instance: T): void {
    if (!this.currentCommand.removed.has(id)) {
      if (this.backing.has(id)) {
        this.currentCommand.mutated.set(id, instance);
      } else if (this.currentCommand.added.has(id)) {
        this.currentCommand.added.set(id, instance);
      }
    }
  }
  remove(id: string): void {
    if (this.backing.has(id)) {
      this.currentCommand.added.delete(id);
      this.currentCommand.mutated.delete(id);
      this.currentCommand.removed.add(id);
    }
  }
  command(): WGBKInstanceCommand<T> {
    const { added, mutated, removed } = this.currentCommand;
    added.forEach((instance, id) => this.backing.set(id, instance));
    mutated.forEach((instance, id) => this.backing.set(id, instance));
    removed.forEach((id) => this.backing.delete(id));
    const command: WGBKInstanceCommand<T> = {
      added: new Map(added),
      mutated: new Map(mutated),
      removed: new Set(removed),
    };
    added.clear();
    removed.clear();
    mutated.clear();
    return command;
  }
}
