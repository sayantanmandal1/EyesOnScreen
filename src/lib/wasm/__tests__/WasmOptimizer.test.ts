/**
 * Tests for WasmOptimizer class
 */

import { WasmOptimizer, checkWasmSupport } from '../WasmOptimizer';

// Mock ImageData for Node.js environment
global.ImageData = class ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  
  constructor(data: Uint8ClampedArray | number, width?: number, height?: number) {
    if (typeof data === 'number') {
      this.width = data;
      this.height = width!;
      this.data = new Uint8ClampedArray(data * width! * 4);
    } else {
      this.data = data;
      this.width = width!;
      this.height = height!;
    }
  }
} as any;

// Mock WebAssembly
const mockWasmModule = {
  exports: {
    multiply_matrices: jest.fn(),
    process_blur: jest.fn(),
    compute_fft: jest.fn(),
    convolve_2d: jest.fn()
  }
};

const mockWasmInstance = {
  exports: mockWasmModule.exports
};

// Mock fetch
global.fetch = jest.fn();

// Mock WebAssembly
Object.defineProperty(global, 'WebAssembly', {
  value: {
    compile: jest.fn().mockResolvedValue(mockWasmModule),
    instantiate: jest.fn().mockResolvedValue(mockWasmInstance),
    Memory: jest.fn().mockImplementation(() => ({
      buffer: new ArrayBuffer(1024 * 1024) // 1MB
    })),
    SIMD: {} // Mock SIMD support
  },
  writable: true
});

describe('WasmOptimizer', () => {
  let optimizer: WasmOptimizer;

  beforeEach(() => {
    optimizer = new WasmOptimizer({
      enableMemoryPooling: true,
      maxPoolSize: 5,
      lazyLoadModules: true,
      preloadCritical: false
    });
    
    jest.clearAllMocks();
    
    // Mock successful fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
  });

  afterEach(() => {
    optimizer.cleanup();
  });

  describe('Module Registration and Loading', () => {
    it('should register modules correctly', () => {
      optimizer.registerModule('test-module', '/wasm/test.wasm', '/js/test.js');
      
      expect(optimizer.isModuleLoaded('test-module')).toBe(false);
    });

    it('should load modules successfully', async () => {
      optimizer.registerModule('test-module', '/wasm/test.wasm');
      
      const module = await optimizer.loadModule('test-module');
      
      expect(module.loaded).toBe(true);
      expect(module.instance).toBeDefined();
      expect(module.exports).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith('/wasm/test.wasm');
    });

    it('should cache loaded modules', async () => {
      optimizer.registerModule('test-module', '/wasm/test.wasm');
      
      const module1 = await optimizer.loadModule('test-module');
      const module2 = await optimizer.loadModule('test-module');
      
      expect(module1).toBe(module2);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent loading requests', async () => {
      optimizer.registerModule('test-module', '/wasm/test.wasm');
      
      const [module1, module2] = await Promise.all([
        optimizer.loadModule('test-module'),
        optimizer.loadModule('test-module')
      ]);
      
      expect(module1).toBe(module2);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unregistered modules', async () => {
      await expect(optimizer.loadModule('nonexistent')).rejects.toThrow('Module nonexistent not registered');
    });

    it('should handle fetch failures', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404
      });
      
      optimizer.registerModule('test-module', '/wasm/test.wasm');
      
      await expect(optimizer.loadModule('test-module')).rejects.toThrow('Failed to fetch WASM module');
    });

    it('should get module exports', async () => {
      optimizer.registerModule('test-module', '/wasm/test.wasm');
      await optimizer.loadModule('test-module');
      
      const exports = optimizer.getModuleExports('test-module');
      
      expect(exports).toBe(mockWasmModule.exports);
    });

    it('should return null for unloaded module exports', () => {
      optimizer.registerModule('test-module', '/wasm/test.wasm');
      
      const exports = optimizer.getModuleExports('test-module');
      
      expect(exports).toBeNull();
    });
  });

  describe('Memory Pooling', () => {
    it('should get pooled buffers', () => {
      const buffer = optimizer.getPooledBuffer(1024);
      
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer!.byteLength).toBeGreaterThanOrEqual(1024);
    });

    it('should reuse returned buffers', () => {
      const buffer1 = optimizer.getPooledBuffer(1024);
      optimizer.returnPooledBuffer(buffer1!);
      
      const buffer2 = optimizer.getPooledBuffer(1024);
      
      expect(buffer2).toBe(buffer1);
    });

    it('should create new buffers when pool is empty', () => {
      const buffers = [];
      
      // Fill the pool
      for (let i = 0; i < 6; i++) { // maxPoolSize is 5
        buffers.push(optimizer.getPooledBuffer(1024));
      }
      
      // All buffers should be different
      const uniqueBuffers = new Set(buffers);
      expect(uniqueBuffers.size).toBe(6);
    });

    it('should handle different pool names', () => {
      const buffer1 = optimizer.getPooledBuffer(1024, 'pool1');
      const buffer2 = optimizer.getPooledBuffer(1024, 'pool2');
      
      expect(buffer1).toBeInstanceOf(ArrayBuffer);
      expect(buffer2).toBeInstanceOf(ArrayBuffer);
      expect(buffer1).not.toBe(buffer2);
      
      optimizer.returnPooledBuffer(buffer1!, 'pool1');
      optimizer.returnPooledBuffer(buffer2!, 'pool2');
      
      const buffer3 = optimizer.getPooledBuffer(1024, 'pool1');
      const buffer4 = optimizer.getPooledBuffer(1024, 'pool2');
      
      expect(buffer3).toBeInstanceOf(ArrayBuffer);
      expect(buffer4).toBeInstanceOf(ArrayBuffer);
    });

    it('should work with memory pooling disabled', () => {
      const optimizerNoPool = new WasmOptimizer({ enableMemoryPooling: false });
      
      const buffer1 = optimizerNoPool.getPooledBuffer(1024);
      const buffer2 = optimizerNoPool.getPooledBuffer(1024);
      
      expect(buffer1).not.toBe(buffer2);
      
      optimizerNoPool.cleanup();
    });
  });

  describe('Matrix Operations', () => {
    beforeEach(() => {
      optimizer.registerModule('matrix-ops', '/wasm/matrix-ops.wasm');
    });

    it('should perform matrix multiplication with WASM', async () => {
      mockWasmModule.exports.multiply_matrices.mockReturnValue(0);
      
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);
      
      const result = await optimizer.multiplyMatrices(a, b, 2, 2, 2);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(mockWasmModule.exports.multiply_matrices).toHaveBeenCalled();
    });

    it('should fallback to JavaScript when WASM unavailable', async () => {
      // Mock module without multiply_matrices export
      const mockModuleNoExport = { exports: {} };
      (WebAssembly.compile as jest.Mock).mockResolvedValueOnce(mockModuleNoExport);
      (WebAssembly.instantiate as jest.Mock).mockResolvedValueOnce({ exports: {} });
      
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);
      
      const result = await optimizer.multiplyMatrices(a, b, 2, 2, 2);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(4);
      // Test actual multiplication: [1,2;3,4] * [5,6;7,8] = [19,22;43,50]
      expect(result[0]).toBe(19);
      expect(result[1]).toBe(22);
      expect(result[2]).toBe(43);
      expect(result[3]).toBe(50);
    });
  });

  describe('Image Processing', () => {
    beforeEach(() => {
      optimizer.registerModule('image-processing', '/wasm/image-processing.wasm');
    });

    it('should process image data with WASM', async () => {
      mockWasmModule.exports.process_blur = jest.fn();
      
      const imageData = new ImageData(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1);
      
      const result = await optimizer.processImageData(imageData, 'blur');
      
      expect(result).toBeInstanceOf(ImageData);
      expect(mockWasmModule.exports.process_blur).toHaveBeenCalled();
    });

    it('should fallback to JavaScript for image processing', async () => {
      // Mock module without image processing exports
      const mockModuleNoExport = { exports: {} };
      (WebAssembly.compile as jest.Mock).mockResolvedValueOnce(mockModuleNoExport);
      (WebAssembly.instantiate as jest.Mock).mockResolvedValueOnce({ exports: {} });
      
      const imageData = new ImageData(new Uint8ClampedArray([255, 128, 64, 255]), 1, 1);
      
      const result = await optimizer.processImageData(imageData, 'grayscale');
      
      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      
      // Check grayscale conversion
      const gray = 0.299 * 255 + 0.587 * 128 + 0.114 * 64;
      expect(result.data[0]).toBeCloseTo(gray, 0);
      expect(result.data[1]).toBeCloseTo(gray, 0);
      expect(result.data[2]).toBeCloseTo(gray, 0);
    });
  });

  describe('Signal Processing', () => {
    beforeEach(() => {
      optimizer.registerModule('signal-processing', '/wasm/signal-processing.wasm');
    });

    it('should compute FFT with WASM', async () => {
      // Reset the mock to ensure it's called
      mockWasmModule.exports.compute_fft = jest.fn();
      
      const signal = new Float32Array([1, 0, -1, 0]);
      
      const result = await optimizer.computeFFT(signal);
      
      expect(result.real).toBeInstanceOf(Float32Array);
      expect(result.imag).toBeInstanceOf(Float32Array);
      // The mock should be called if the module is loaded correctly
      expect(mockWasmModule.exports.compute_fft).toHaveBeenCalled();
    });

    it('should fallback to JavaScript FFT', async () => {
      // Mock module without FFT export
      const mockModuleNoExport = { exports: {} };
      (WebAssembly.compile as jest.Mock).mockResolvedValueOnce(mockModuleNoExport);
      (WebAssembly.instantiate as jest.Mock).mockResolvedValueOnce({ exports: {} });
      
      const signal = new Float32Array([1, 0, 0, 0]);
      
      const result = await optimizer.computeFFT(signal);
      
      expect(result.real).toBeInstanceOf(Float32Array);
      expect(result.imag).toBeInstanceOf(Float32Array);
      expect(result.real.length).toBe(4);
      expect(result.imag.length).toBe(4);
      
      // DC component should be 1
      expect(result.real[0]).toBe(1);
      expect(result.imag[0]).toBe(0);
    });
  });

  describe('Convolution', () => {
    beforeEach(() => {
      optimizer.registerModule('convolution', '/wasm/convolution.wasm');
    });

    it('should perform 2D convolution with WASM', async () => {
      mockWasmModule.exports.convolve_2d = jest.fn();
      
      const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const kernel = new Float32Array([1, 0, -1, 2, 0, -2, 1, 0, -1]);
      
      const result = await optimizer.convolve2D(input, kernel, 3, 3, 3);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(mockWasmModule.exports.convolve_2d).toHaveBeenCalled();
    });

    it('should fallback to JavaScript convolution', async () => {
      // Mock module without convolution export
      const mockModuleNoExport = { exports: {} };
      (WebAssembly.compile as jest.Mock).mockResolvedValueOnce(mockModuleNoExport);
      (WebAssembly.instantiate as jest.Mock).mockResolvedValueOnce({ exports: {} });
      
      const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const kernel = new Float32Array([1]); // Identity kernel
      
      const result = await optimizer.convolve2D(input, kernel, 3, 3, 1);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(9);
    });
  });

  describe('Statistics and Management', () => {
    it('should provide accurate statistics', async () => {
      optimizer.registerModule('module1', '/wasm/module1.wasm');
      optimizer.registerModule('module2', '/wasm/module2.wasm');
      
      await optimizer.loadModule('module1');
      
      // Get some buffers to test memory pool stats (use default pools)
      optimizer.getPooledBuffer(1024, 'default');
      optimizer.getPooledBuffer(2048, 'matrix');
      
      const stats = optimizer.getStats();
      
      expect(stats.loadedModules).toBe(1);
      expect(stats.totalModules).toBe(2);
      expect(stats.memoryPools['default']).toBeDefined();
      expect(stats.memoryPools['matrix']).toBeDefined();
      expect(stats.simdSupport).toBe(true); // Mocked as true
    });

    it('should preload critical modules', async () => {
      const optimizerWithPreload = new WasmOptimizer({ preloadCritical: true });
      
      optimizerWithPreload.registerModule('critical1', '/wasm/critical1.wasm');
      optimizerWithPreload.registerModule('critical2', '/wasm/critical2.wasm');
      
      await optimizerWithPreload.preloadCriticalModules(['critical1', 'critical2']);
      
      expect(optimizerWithPreload.isModuleLoaded('critical1')).toBe(true);
      expect(optimizerWithPreload.isModuleLoaded('critical2')).toBe(true);
      
      optimizerWithPreload.cleanup();
    });

    it('should skip preloading when disabled', async () => {
      const optimizerNoPreload = new WasmOptimizer({ preloadCritical: false });
      
      optimizerNoPreload.registerModule('module1', '/wasm/module1.wasm');
      
      await optimizerNoPreload.preloadCriticalModules(['module1']);
      
      expect(optimizerNoPreload.isModuleLoaded('module1')).toBe(false);
      
      optimizerNoPreload.cleanup();
    });

    it('should cleanup resources properly', () => {
      optimizer.registerModule('test-module', '/wasm/test.wasm');
      optimizer.getPooledBuffer(1024);
      
      const statsBefore = optimizer.getStats();
      expect(statsBefore.totalModules).toBeGreaterThan(0);
      
      optimizer.cleanup();
      
      const stats = optimizer.getStats();
      expect(stats.totalModules).toBe(0);
      // Memory pools are cleared but the structure remains with 0 buffers
      expect(Object.keys(stats.memoryPools)).toContain('default');
      expect(stats.memoryPools['default'].buffers).toBe(0);
    });
  });

  describe('Feature Detection', () => {
    it('should detect WASM support correctly', () => {
      const support = checkWasmSupport();
      
      expect(support.basic).toBe(true);
      expect(support.simd).toBe(true);
      expect(typeof support.threads).toBe('boolean');
      expect(typeof support.bigInt).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebAssembly compilation errors', async () => {
      (WebAssembly.compile as jest.Mock).mockRejectedValueOnce(new Error('Compilation failed'));
      
      optimizer.registerModule('bad-module', '/wasm/bad.wasm');
      
      await expect(optimizer.loadModule('bad-module')).rejects.toThrow('Compilation failed');
    });

    it('should handle WebAssembly instantiation errors', async () => {
      (WebAssembly.instantiate as jest.Mock).mockRejectedValueOnce(new Error('Instantiation failed'));
      
      optimizer.registerModule('bad-module', '/wasm/bad.wasm');
      
      await expect(optimizer.loadModule('bad-module')).rejects.toThrow('Instantiation failed');
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      optimizer.registerModule('network-fail', '/wasm/network-fail.wasm');
      
      await expect(optimizer.loadModule('network-fail')).rejects.toThrow('Network error');
    });
  });

  describe('Configuration Options', () => {
    it('should respect configuration options', () => {
      const customOptimizer = new WasmOptimizer({
        enableMemoryPooling: false,
        maxPoolSize: 20,
        lazyLoadModules: false,
        preloadCritical: true,
        enableSIMD: false,
        enableThreads: false
      });
      
      const stats = customOptimizer.getStats();
      expect(stats.simdSupport).toBe(false);
      expect(stats.threadSupport).toBe(false);
      
      // Test that memory pooling is disabled
      const buffer1 = customOptimizer.getPooledBuffer(1024);
      const buffer2 = customOptimizer.getPooledBuffer(1024);
      expect(buffer1).not.toBe(buffer2);
      
      customOptimizer.cleanup();
    });
  });

  describe('JavaScript Fallbacks', () => {
    it('should handle blur operation fallback', async () => {
      const mockModuleNoExport = { exports: {} };
      (WebAssembly.compile as jest.Mock).mockResolvedValueOnce(mockModuleNoExport);
      (WebAssembly.instantiate as jest.Mock).mockResolvedValueOnce({ exports: {} });
      
      optimizer.registerModule('image-processing', '/wasm/image-processing.wasm');
      
      // Create a 3x3 red image
      const data = new Uint8ClampedArray(36); // 3x3x4 channels
      for (let i = 0; i < 36; i += 4) {
        data[i] = 255; // Red
        data[i + 1] = 0; // Green
        data[i + 2] = 0; // Blue
        data[i + 3] = 255; // Alpha
      }
      
      const imageData = new ImageData(data, 3, 3);
      const result = await optimizer.processImageData(imageData, 'blur');
      
      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(3);
      expect(result.height).toBe(3);
    });
  });
});