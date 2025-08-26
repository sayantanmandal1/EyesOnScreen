/**
 * CircularBuffer tests
 */

import { CircularBuffer } from '../filters/CircularBuffer';

describe('CircularBuffer', () => {
  let buffer: CircularBuffer<number>;

  beforeEach(() => {
    buffer = new CircularBuffer<number>(5);
  });

  describe('initialization', () => {
    it('should initialize with specified capacity', () => {
      expect(buffer.getCapacity()).toBe(5);
      expect(buffer.getSize()).toBe(0);
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.isFull()).toBe(false);
    });

    it('should throw error for invalid capacity', () => {
      expect(() => new CircularBuffer<number>(0)).toThrow();
      expect(() => new CircularBuffer<number>(-1)).toThrow();
    });
  });

  describe('basic operations', () => {
    it('should push items correctly', () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      expect(buffer.getSize()).toBe(3);
      expect(buffer.isEmpty()).toBe(false);
      expect(buffer.isFull()).toBe(false);
    });

    it('should handle buffer overflow', () => {
      // Fill buffer beyond capacity
      for (let i = 1; i <= 7; i++) {
        buffer.push(i);
      }

      expect(buffer.getSize()).toBe(5);
      expect(buffer.isFull()).toBe(true);
      
      // Should contain the last 5 items (3, 4, 5, 6, 7)
      const array = buffer.toArray();
      expect(array).toEqual([3, 4, 5, 6, 7]);
    });

    it('should get items by index', () => {
      buffer.push(10);
      buffer.push(20);
      buffer.push(30);

      expect(buffer.get(0)).toBe(10); // Oldest
      expect(buffer.get(1)).toBe(20);
      expect(buffer.get(2)).toBe(30); // Newest
      expect(buffer.get(3)).toBeUndefined(); // Out of bounds
    });

    it('should get latest item', () => {
      expect(buffer.latest()).toBeUndefined(); // Empty buffer

      buffer.push(100);
      expect(buffer.latest()).toBe(100);

      buffer.push(200);
      expect(buffer.latest()).toBe(200);
    });

    it('should convert to array correctly', () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      const array = buffer.toArray();
      expect(array).toEqual([1, 2, 3]);
    });
  });

  describe('statistical operations', () => {
    beforeEach(() => {
      // Add test data: [2, 4, 6, 8, 10]
      [2, 4, 6, 8, 10].forEach(val => buffer.push(val));
    });

    it('should calculate mean correctly', () => {
      expect(buffer.mean()).toBe(6); // (2+4+6+8+10)/5 = 6
    });

    it('should calculate variance correctly', () => {
      const expectedVariance = 8; // Variance of [2,4,6,8,10]
      expect(buffer.variance()).toBeCloseTo(expectedVariance, 1);
    });

    it('should calculate standard deviation correctly', () => {
      const expectedStdDev = Math.sqrt(8);
      expect(buffer.standardDeviation()).toBeCloseTo(expectedStdDev, 1);
    });

    it('should find minimum value', () => {
      expect(buffer.min()).toBe(2);
    });

    it('should find maximum value', () => {
      expect(buffer.max()).toBe(10);
    });

    it('should handle empty buffer statistics', () => {
      const emptyBuffer = new CircularBuffer<number>(5);
      
      expect(emptyBuffer.mean()).toBe(0);
      expect(emptyBuffer.variance()).toBe(0);
      expect(emptyBuffer.standardDeviation()).toBe(0);
      expect(emptyBuffer.min()).toBeUndefined();
      expect(emptyBuffer.max()).toBeUndefined();
    });
  });

  describe('buffer management', () => {
    it('should clear buffer correctly', () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      expect(buffer.getSize()).toBe(3);

      buffer.clear();

      expect(buffer.getSize()).toBe(0);
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.toArray()).toEqual([]);
    });

    it('should handle circular wrapping correctly', () => {
      // Fill buffer to capacity
      for (let i = 1; i <= 5; i++) {
        buffer.push(i);
      }

      // Add more items to test wrapping
      buffer.push(6);
      buffer.push(7);

      // Should contain [3, 4, 5, 6, 7]
      expect(buffer.toArray()).toEqual([3, 4, 5, 6, 7]);
      expect(buffer.get(0)).toBe(3); // Oldest after wrapping
      expect(buffer.latest()).toBe(7); // Newest
    });
  });

  describe('edge cases', () => {
    it('should handle single item buffer', () => {
      const singleBuffer = new CircularBuffer<number>(1);
      
      singleBuffer.push(42);
      expect(singleBuffer.getSize()).toBe(1);
      expect(singleBuffer.latest()).toBe(42);
      
      singleBuffer.push(99);
      expect(singleBuffer.getSize()).toBe(1);
      expect(singleBuffer.latest()).toBe(99);
      expect(singleBuffer.toArray()).toEqual([99]);
    });

    it('should handle different data types', () => {
      const stringBuffer = new CircularBuffer<string>(3);
      
      stringBuffer.push('a');
      stringBuffer.push('b');
      stringBuffer.push('c');
      
      expect(stringBuffer.toArray()).toEqual(['a', 'b', 'c']);
      expect(stringBuffer.latest()).toBe('c');
    });

    it('should handle object data', () => {
      interface TestObject {
        id: number;
        value: string;
      }
      
      const objectBuffer = new CircularBuffer<TestObject>(2);
      
      const obj1 = { id: 1, value: 'first' };
      const obj2 = { id: 2, value: 'second' };
      const obj3 = { id: 3, value: 'third' };
      
      objectBuffer.push(obj1);
      objectBuffer.push(obj2);
      objectBuffer.push(obj3);
      
      expect(objectBuffer.toArray()).toEqual([obj2, obj3]);
      expect(objectBuffer.latest()).toBe(obj3);
    });
  });
});