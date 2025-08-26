import {
  clamp,
  debounce,
  throttle,
  formatTime,
  formatBytes,
  calculateDistance,
  normalizeAngle,
  interpolate,
  generateId,
  deepClone,
  isValidEmail,
  sanitizeInput
} from '../helpers';

describe('Utility Helpers', () => {
  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(clamp(0, 0, 0)).toBe(0);
      expect(clamp(5, 5, 5)).toBe(5);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('should debounce function calls', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should cancel previous calls', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn();
      jest.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    it('should throttle function calls', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should execute immediately on first call', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('formatTime', () => {
    it('should format seconds correctly', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(30)).toBe('0:30');
      expect(formatTime(60)).toBe('1:00');
      expect(formatTime(90)).toBe('1:30');
      expect(formatTime(3661)).toBe('61:01');
    });

    it('should handle negative values', () => {
      expect(formatTime(-30)).toBe('0:00');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(1073741824)).toBe('1.0 GB');
    });

    it('should handle decimal places', () => {
      expect(formatBytes(1536, 2)).toBe('1.50 KB');
      expect(formatBytes(1536, 0)).toBe('2 KB');
    });
  });

  describe('calculateDistance', () => {
    it('should calculate 2D distance correctly', () => {
      expect(calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
      expect(calculateDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
    });

    it('should calculate 3D distance correctly', () => {
      const point1 = { x: 0, y: 0, z: 0 };
      const point2 = { x: 1, y: 1, z: 1 };
      expect(calculateDistance(point1, point2)).toBeCloseTo(Math.sqrt(3));
    });
  });

  describe('normalizeAngle', () => {
    it('should normalize angles to [-180, 180] range', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(180)).toBe(180);
      expect(normalizeAngle(-180)).toBe(-180);
      expect(normalizeAngle(270)).toBe(-90);
      expect(normalizeAngle(-270)).toBe(90);
      expect(normalizeAngle(450)).toBe(90);
    });
  });

  describe('interpolate', () => {
    it('should interpolate between values', () => {
      expect(interpolate(0, 10, 0.5)).toBe(5);
      expect(interpolate(0, 10, 0)).toBe(0);
      expect(interpolate(0, 10, 1)).toBe(10);
      expect(interpolate(-5, 5, 0.5)).toBe(0);
    });

    it('should handle extrapolation', () => {
      expect(interpolate(0, 10, 1.5)).toBe(15);
      expect(interpolate(0, 10, -0.5)).toBe(-5);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate IDs with specified length', () => {
      const id = generateId(16);
      expect(id.length).toBe(16);
    });
  });

  describe('deepClone', () => {
    it('should deep clone objects', () => {
      const original = {
        a: 1,
        b: {
          c: 2,
          d: [3, 4, { e: 5 }]
        }
      };

      const cloned = deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.b.d).not.toBe(original.b.d);
    });

    it('should handle arrays', () => {
      const original = [1, { a: 2 }, [3, 4]];
      const cloned = deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[1]).not.toBe(original[1]);
    });

    it('should handle null and undefined', () => {
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });

    it('should handle primitive values', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('string')).toBe('string');
      expect(deepClone(true)).toBe(true);
    });
  });

  describe('isValidEmail', () => {
    it('should validate email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize HTML input', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(sanitizeInput('<b>Bold</b> text')).toBe('Bold text');
      expect(sanitizeInput('Normal text')).toBe('Normal text');
    });

    it('should handle empty input', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
    });
  });
});