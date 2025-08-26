/**
 * KalmanFilter tests
 */

import { KalmanFilter, VectorKalmanFilter } from '../filters/KalmanFilter';

describe('KalmanFilter', () => {
  let filter: KalmanFilter;

  beforeEach(() => {
    filter = new KalmanFilter(0.01, 0.1);
  });

  describe('initialization', () => {
    it('should initialize with default parameters', () => {
      const defaultFilter = new KalmanFilter();
      expect(defaultFilter).toBeDefined();
    });

    it('should initialize with custom parameters', () => {
      const customFilter = new KalmanFilter(0.05, 0.2);
      expect(customFilter).toBeDefined();
    });
  });

  describe('filtering', () => {
    it('should return first measurement as initial state', () => {
      const measurement = 5.0;
      const result = filter.update(measurement);
      expect(result).toBe(measurement);
    });

    it('should smooth noisy measurements', () => {
      const trueMeasurement = 10.0;
      const noisyMeasurements = [
        trueMeasurement + 2,
        trueMeasurement - 1.5,
        trueMeasurement + 0.8,
        trueMeasurement - 0.3,
        trueMeasurement + 0.1
      ];

      let lastResult = 0;
      noisyMeasurements.forEach(measurement => {
        lastResult = filter.update(measurement);
      });

      // Final result should be closer to true value than individual noisy measurements
      expect(Math.abs(lastResult - trueMeasurement)).toBeLessThan(1.0);
    });

    it('should track changing signal', () => {
      const measurements = [0, 1, 2, 3, 4, 5];
      const results: number[] = [];

      measurements.forEach(measurement => {
        results.push(filter.update(measurement));
      });

      // Results should generally follow the trend
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThan(results[i - 1]);
      }
    });

    it('should provide state and covariance', () => {
      filter.update(5.0);
      filter.update(5.2);

      expect(filter.getState()).toBeCloseTo(5.1, 0);
      expect(filter.getCovariance()).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    it('should allow noise parameter updates', () => {
      filter.setNoiseParameters(0.1, 0.5);
      
      // Process some measurements
      filter.update(1.0);
      filter.update(1.1);
      
      expect(filter.getState()).toBeDefined();
    });

    it('should reset properly', () => {
      filter.update(5.0);
      filter.update(6.0);
      
      const stateBeforeReset = filter.getState();
      expect(stateBeforeReset).not.toBe(0);
      
      filter.reset();
      
      // After reset, first measurement should be returned as-is
      const firstAfterReset = filter.update(10.0);
      expect(firstAfterReset).toBe(10.0);
    });
  });
});

describe('VectorKalmanFilter', () => {
  let vectorFilter: VectorKalmanFilter;

  beforeEach(() => {
    vectorFilter = new VectorKalmanFilter(3, 0.01, 0.1);
  });

  describe('initialization', () => {
    it('should initialize with specified dimension', () => {
      const filter2D = new VectorKalmanFilter(2);
      const filter5D = new VectorKalmanFilter(5);
      
      expect(filter2D).toBeDefined();
      expect(filter5D).toBeDefined();
    });
  });

  describe('vector filtering', () => {
    it('should handle 3D vector measurements', () => {
      const measurement = [1.0, 2.0, 3.0];
      const result = vectorFilter.update(measurement);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(measurement[0]);
      expect(result[1]).toBe(measurement[1]);
      expect(result[2]).toBe(measurement[2]);
    });

    it('should smooth noisy vector data', () => {
      const trueVector = [5.0, -2.0, 1.0];
      const noisyMeasurements = [
        [5.2, -1.8, 1.1],
        [4.9, -2.1, 0.9],
        [5.1, -1.9, 1.0],
        [4.8, -2.2, 1.2],
        [5.0, -2.0, 0.8]
      ];

      let lastResult: number[] = [];
      noisyMeasurements.forEach(measurement => {
        lastResult = vectorFilter.update(measurement);
      });

      // Each component should be close to true value
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(lastResult[i] - trueVector[i])).toBeLessThan(0.3);
      }
    });

    it('should validate measurement dimension', () => {
      expect(() => {
        vectorFilter.update([1.0, 2.0]); // Wrong dimension
      }).toThrow();
    });

    it('should provide vector state', () => {
      vectorFilter.update([1.0, 2.0, 3.0]);
      vectorFilter.update([1.1, 2.1, 3.1]);
      
      const state = vectorFilter.getState();
      expect(state).toHaveLength(3);
      expect(state[0]).toBeCloseTo(1.05, 1);
      expect(state[1]).toBeCloseTo(2.05, 1);
      expect(state[2]).toBeCloseTo(3.05, 1);
    });
  });

  describe('configuration', () => {
    it('should reset all component filters', () => {
      vectorFilter.update([1.0, 2.0, 3.0]);
      vectorFilter.update([1.1, 2.1, 3.1]);
      
      vectorFilter.reset();
      
      const firstAfterReset = vectorFilter.update([5.0, 6.0, 7.0]);
      expect(firstAfterReset[0]).toBe(5.0);
      expect(firstAfterReset[1]).toBe(6.0);
      expect(firstAfterReset[2]).toBe(7.0);
    });

    it('should update noise parameters for all filters', () => {
      vectorFilter.setNoiseParameters(0.1, 0.5);
      
      // Should not throw and should process measurements
      const result = vectorFilter.update([1.0, 2.0, 3.0]);
      expect(result).toHaveLength(3);
    });
  });
});