/**
 * Circular Buffer implementation for efficient signal buffering
 * 
 * Provides fixed-size buffer with automatic overwriting of old data
 */

export class CircularBuffer<T> {
  private buffer: T[];
  private head = 0;
  private tail = 0;
  private size = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be positive');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add item to buffer
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    
    if (this.size < this.capacity) {
      this.size++;
    } else {
      // Buffer is full, move head forward
      this.head = (this.head + 1) % this.capacity;
    }
    
    this.tail = (this.tail + 1) % this.capacity;
  }

  /**
   * Get item at index (0 = oldest, size-1 = newest)
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.size) {
      return undefined;
    }
    
    const actualIndex = (this.head + index) % this.capacity;
    return this.buffer[actualIndex];
  }

  /**
   * Get the most recent item
   */
  latest(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    
    const latestIndex = this.tail === 0 ? this.capacity - 1 : this.tail - 1;
    return this.buffer[latestIndex];
  }

  /**
   * Get all items as array (oldest to newest)
   */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const item = this.get(i);
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Get current size
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Get capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.size === this.capacity;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  /**
   * Calculate mean of numeric values
   */
  mean(): number {
    if (this.size === 0) {
      return 0;
    }

    const values = this.toArray() as number[];
    const sum = values.reduce((acc, val) => acc + (typeof val === 'number' ? val : 0), 0);
    return sum / this.size;
  }

  /**
   * Calculate variance of numeric values
   */
  variance(): number {
    if (this.size === 0) {
      return 0;
    }

    const values = this.toArray() as number[];
    const mean = this.mean();
    const squaredDiffs = values.map(val => {
      const num = typeof val === 'number' ? val : 0;
      return Math.pow(num - mean, 2);
    });
    
    return squaredDiffs.reduce((acc, val) => acc + val, 0) / this.size;
  }

  /**
   * Calculate standard deviation of numeric values
   */
  standardDeviation(): number {
    return Math.sqrt(this.variance());
  }

  /**
   * Find minimum value
   */
  min(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }

    const values = this.toArray();
    return values.reduce((min, current) => {
      if (typeof min === 'number' && typeof current === 'number') {
        return Math.min(min, current) as T;
      }
      return min;
    });
  }

  /**
   * Find maximum value
   */
  max(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }

    const values = this.toArray();
    return values.reduce((max, current) => {
      if (typeof max === 'number' && typeof current === 'number') {
        return Math.max(max, current) as T;
      }
      return max;
    });
  }
}