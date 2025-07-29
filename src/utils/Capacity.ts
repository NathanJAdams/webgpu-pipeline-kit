export class Capacity {
  private _capacity = 0;

  constructor(
        private readonly min: number,
        private readonly requiredMultiple: number,
        private readonly capacityMultiple: number,
  ) {
    this._capacity = min;
  }

  get capacity(): number {
    return this._capacity;
  }
  set capacity(capacity: number) {
    this._capacity = capacity;
  }

  ensureCapacity(required: number): boolean {
    const oldCapacity = this._capacity;
    const hasIncreased = (required > this._capacity);
    if (hasIncreased) {
      this._capacity = Math.round(
        Math.max(
          this.min,
          required * this.requiredMultiple,
          oldCapacity * this.capacityMultiple,
        )
      );
    }
    return hasIncreased;
  }
}
