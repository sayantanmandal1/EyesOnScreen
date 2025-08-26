/**
 * Exponential Moving Average Filter
 * 
 * Provides smooth filtering with exponential decay for temporal signals
 */

export class ExponentialMovingAverage {
  private value: number | null = null;
  private alpha: number; // Smoothing factor (0 < alpha <= 1)

  constructor(alpha = 0.3) {
    if (alpha <= 0 || alpha > 1) {
      throw new Error('Alpha must be between 0 and 1');
    }
    this.alpha = alpha;
  }

  /**
   * Update the filter with a new value
   */
  update(newValue: number): number {
    if (this.value === null) {
      this.value = newValue;
    } else {
      this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
    }
    return this.value;
  }

  /**
   * Get current filtered value
   */
  getValue(): number | null {
    return this.value;
  }

  /**
   * Reset the filter
   */
  reset(): void {
    this.value = null;
  }

  /**
   * Set smoothing factor
   */
  setAlpha(alpha: number): void {
    if (alpha <= 0 || alpha > 1) {
      throw new Error('Alpha must be between 0 and 1');
    }
    this.alpha = alpha;
  }

  /**
   * Get current smoothing factor
   */
  getAlpha(): number {
    return this.alpha;
  }
}

/**
 * Vector Exponential Moving Average for multi-dimensional data
 */
export class VectorExponentialMovingAverage {
  private filters: ExponentialMovingAverage[];
  private dimension: number;

  constructor(dimension: number, alpha = 0.3) {
    this.dimension = dimension;
    this.filters = Array.from(
      { length: dimension },
      () => new ExponentialMovingAverage(alpha)
    );
  }

  /**
   * Update with vector input
   */
  update(newValues: number[]): number[] {
    if (newValues.length !== this.dimension) {
      throw new Error(`Input dimension ${newValues.length} does not match filter dimension ${this.dimension}`);
    }

    return this.filters.map((filter, i) => filter.update(newValues[i]));
  }

  /**
   * Get current filtered vector
   */
  getValue(): (number | null)[] {
    return this.filters.map(filter => filter.getValue());
  }

  /**
   * Reset all filters
   */
  reset(): void {
    this.filters.forEach(filter => filter.reset());
  }

  /**
   * Set smoothing factor for all filters
   */
  setAlpha(alpha: number): void {
    this.filters.forEach(filter => filter.setAlpha(alpha));
  }
}