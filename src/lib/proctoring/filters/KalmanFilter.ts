/**
 * Kalman Filter implementation for landmark smoothing
 * 
 * Provides optimal estimation for noisy measurements with temporal consistency
 */

export class KalmanFilter {
  private state: number; // Current state estimate
  private covariance: number; // Current error covariance
  private processNoise: number; // Process noise variance
  private measurementNoise: number; // Measurement noise variance
  private initialized = false;

  constructor(
    processNoise = 0.01,
    measurementNoise = 0.1
  ) {
    this.state = 0;
    this.covariance = 1;
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }

  /**
   * Update the filter with a new measurement
   */
  update(measurement: number): number {
    if (!this.initialized) {
      this.state = measurement;
      this.initialized = true;
      return this.state;
    }

    // Prediction step
    // State prediction (assuming constant velocity model)
    const predictedState = this.state;
    const predictedCovariance = this.covariance + this.processNoise;

    // Update step
    // Kalman gain
    const kalmanGain = predictedCovariance / (predictedCovariance + this.measurementNoise);

    // State update
    this.state = predictedState + kalmanGain * (measurement - predictedState);
    
    // Covariance update
    this.covariance = (1 - kalmanGain) * predictedCovariance;

    return this.state;
  }

  /**
   * Get current state estimate
   */
  getState(): number {
    return this.state;
  }

  /**
   * Get current uncertainty
   */
  getCovariance(): number {
    return this.covariance;
  }

  /**
   * Reset the filter
   */
  reset(): void {
    this.state = 0;
    this.covariance = 1;
    this.initialized = false;
  }

  /**
   * Set noise parameters
   */
  setNoiseParameters(processNoise: number, measurementNoise: number): void {
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }
}

/**
 * Multi-dimensional Kalman Filter for vector data (e.g., 3D coordinates)
 */
export class VectorKalmanFilter {
  private filters: KalmanFilter[];
  private dimension: number;

  constructor(
    dimension: number,
    processNoise = 0.01,
    measurementNoise = 0.1
  ) {
    this.dimension = dimension;
    this.filters = Array.from(
      { length: dimension },
      () => new KalmanFilter(processNoise, measurementNoise)
    );
  }

  /**
   * Update with vector measurement
   */
  update(measurement: number[]): number[] {
    if (measurement.length !== this.dimension) {
      throw new Error(`Measurement dimension ${measurement.length} does not match filter dimension ${this.dimension}`);
    }

    return this.filters.map((filter, i) => filter.update(measurement[i]));
  }

  /**
   * Get current state vector
   */
  getState(): number[] {
    return this.filters.map(filter => filter.getState());
  }

  /**
   * Reset all filters
   */
  reset(): void {
    this.filters.forEach(filter => filter.reset());
  }

  /**
   * Set noise parameters for all filters
   */
  setNoiseParameters(processNoise: number, measurementNoise: number): void {
    this.filters.forEach(filter => filter.setNoiseParameters(processNoise, measurementNoise));
  }
}