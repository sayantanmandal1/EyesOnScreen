/**
 * WebAssembly optimization system for computationally intensive operations
 * Provides memory pooling, lazy loading, and optimized processing
 */

export interface WasmModule {
  name: string;
  wasmPath: string;
  jsPath?: string;
  instance?: WebAssembly.Instance;
  module?: WebAssembly.Module;
  exports?: Record<string, any>;
  loaded: boolean;
  loading: boolean;
}

export interface MemoryPool {
  buffers: ArrayBuffer[];
  sizes: number[];
  inUse: boolean[];
  maxBuffers: number;
}

export interface WasmOptimizationConfig {
  enableMemoryPooling: boolean;
  maxPoolSize: number;
  lazyLoadModules: boolean;
  preloadCritical: boolean;
  enableSIMD: boolean;
  enableThreads: boolean;
}

export class WasmOptimizer {
  private modules = new Map<string, WasmModule>();
  private memoryPools = new Map<string, MemoryPool>();
  private config: WasmOptimizationConfig;
  private loadingPromises = new Map<string, Promise<WasmModule>>();
  
  constructor(config: Partial<WasmOptimizationConfig> = {}) {
    this.config = {
      enableMemoryPooling: true,
      maxPoolSize: 10,
      lazyLoadModules: true,
      preloadCritical: false,
      enableSIMD: this.detectSIMDSupport(),
      enableThreads: this.detectThreadSupport(),
      ...config
    };
    
    this.initializeMemoryPools();
  }
  
  /**
   * Register a WASM module for lazy loading
   */
  registerModule(name: string, wasmPath: string, jsPath?: string): void {
    this.modules.set(name, {
      name,
      wasmPath,
      jsPath,
      loaded: false,
      loading: false
    });
  }
  
  /**
   * Load a WASM module with caching and optimization
   */
  async loadModule(name: string): Promise<WasmModule> {
    const module = this.modules.get(name);
    if (!module) {
      throw new Error(`Module ${name} not registered`);
    }
    
    if (module.loaded && module.instance) {
      return module;
    }
    
    // Check if already loading
    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name)!;
    }
    
    // Start loading
    const loadingPromise = this.loadModuleInternal(module);
    this.loadingPromises.set(name, loadingPromise);
    
    try {
      const loadedModule = await loadingPromise;
      this.loadingPromises.delete(name);
      return loadedModule;
    } catch (error) {
      this.loadingPromises.delete(name);
      throw error;
    }
  }
  
  /**
   * Internal module loading with optimization
   */
  private async loadModuleInternal(module: WasmModule): Promise<WasmModule> {
    module.loading = true;
    
    try {
      // Load WASM binary
      const wasmResponse = await fetch(module.wasmPath);
      if (!wasmResponse.ok) {
        throw new Error(`Failed to fetch WASM module: ${module.wasmPath}`);
      }
      
      const wasmBytes = await wasmResponse.arrayBuffer();
      
      // Compile WASM module
      const wasmModule = await WebAssembly.compile(wasmBytes);
      
      // Create memory with optimization
      const memory = this.createOptimizedMemory();
      
      // Create imports object
      const imports = this.createImports(memory);
      
      // Instantiate WASM module
      const instance = await WebAssembly.instantiate(wasmModule, imports);
      
      // Update module info
      module.module = wasmModule;
      module.instance = instance;
      module.exports = instance.exports;
      module.loaded = true;
      module.loading = false;
      
      console.log(`WASM module ${module.name} loaded successfully`);
      
      return module;
    } catch (error) {
      module.loading = false;
      console.error(`Failed to load WASM module ${module.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Get a loaded module's exports
   */
  getModuleExports(name: string): Record<string, any> | null {
    const module = this.modules.get(name);
    return module?.exports || null;
  }
  
  /**
   * Check if a module is loaded
   */
  isModuleLoaded(name: string): boolean {
    const module = this.modules.get(name);
    return module?.loaded || false;
  }
  
  /**
   * Preload critical modules
   */
  async preloadCriticalModules(moduleNames: string[]): Promise<void> {
    if (!this.config.preloadCritical) {
      return;
    }
    
    const loadPromises = moduleNames.map(name => this.loadModule(name));
    await Promise.all(loadPromises);
  }
  
  /**
   * Get a buffer from the memory pool
   */
  getPooledBuffer(size: number, poolName: string = 'default'): ArrayBuffer | null {
    if (!this.config.enableMemoryPooling) {
      return new ArrayBuffer(size);
    }
    
    const pool = this.memoryPools.get(poolName);
    if (!pool) {
      return new ArrayBuffer(size);
    }
    
    // Find a suitable buffer
    for (let i = 0; i < pool.buffers.length; i++) {
      if (!pool.inUse[i] && pool.sizes[i] >= size) {
        pool.inUse[i] = true;
        return pool.buffers[i];
      }
    }
    
    // Create new buffer if pool not full
    if (pool.buffers.length < pool.maxBuffers) {
      const buffer = new ArrayBuffer(size);
      const index = pool.buffers.length;
      
      pool.buffers.push(buffer);
      pool.sizes.push(size);
      pool.inUse.push(true);
      
      return buffer;
    }
    
    // Pool full, create temporary buffer
    return new ArrayBuffer(size);
  }
  
  /**
   * Return a buffer to the memory pool
   */
  returnPooledBuffer(buffer: ArrayBuffer, poolName: string = 'default'): void {
    if (!this.config.enableMemoryPooling) {
      return;
    }
    
    const pool = this.memoryPools.get(poolName);
    if (!pool) {
      return;
    }
    
    const index = pool.buffers.indexOf(buffer);
    if (index !== -1) {
      pool.inUse[index] = false;
    }
  }
  
  /**
   * Optimized matrix multiplication using WASM
   */
  async multiplyMatrices(
    a: Float32Array,
    b: Float32Array,
    rows: number,
    cols: number,
    inner: number
  ): Promise<Float32Array> {
    const module = await this.loadModule('matrix-ops');
    const exports = module.exports;
    
    if (!exports || !exports.multiply_matrices) {
      // Fallback to JavaScript implementation
      return this.multiplyMatricesJS(a, b, rows, cols, inner);
    }
    
    // Get memory from pool
    const inputSize = (a.length + b.length) * 4; // 4 bytes per float
    const outputSize = rows * cols * 4;
    
    const inputBuffer = this.getPooledBuffer(inputSize, 'matrix');
    const outputBuffer = this.getPooledBuffer(outputSize, 'matrix');
    
    try {
      // Copy input data
      const inputView = new Float32Array(inputBuffer!);
      inputView.set(a, 0);
      inputView.set(b, a.length);
      
      // Call WASM function
      const result = exports.multiply_matrices(
        inputView.byteOffset,
        inputView.byteOffset + a.length * 4,
        rows,
        cols,
        inner
      );
      
      // Copy result
      const outputView = new Float32Array(outputBuffer!, 0, rows * cols);
      return new Float32Array(outputView);
    } finally {
      // Return buffers to pool
      if (inputBuffer) this.returnPooledBuffer(inputBuffer, 'matrix');
      if (outputBuffer) this.returnPooledBuffer(outputBuffer, 'matrix');
    }
  }
  
  /**
   * Optimized image processing using WASM
   */
  async processImageData(
    imageData: ImageData,
    operation: 'blur' | 'sharpen' | 'edge' | 'grayscale'
  ): Promise<ImageData> {
    const module = await this.loadModule('image-processing');
    const exports = module.exports;
    
    if (!exports || !exports[`process_${operation}`]) {
      // Fallback to JavaScript implementation
      return this.processImageDataJS(imageData, operation);
    }
    
    const dataSize = imageData.data.length;
    const buffer = this.getPooledBuffer(dataSize, 'image');
    
    try {
      // Copy image data
      const bufferView = new Uint8ClampedArray(buffer!);
      bufferView.set(imageData.data);
      
      // Call WASM function
      exports[`process_${operation}`](
        bufferView.byteOffset,
        imageData.width,
        imageData.height
      );
      
      // Create result
      const resultData = new ImageData(
        new Uint8ClampedArray(bufferView),
        imageData.width,
        imageData.height
      );
      
      return resultData;
    } finally {
      if (buffer) this.returnPooledBuffer(buffer, 'image');
    }
  }
  
  /**
   * Optimized FFT using WASM
   */
  async computeFFT(signal: Float32Array): Promise<{ real: Float32Array; imag: Float32Array }> {
    const module = await this.loadModule('signal-processing');
    const exports = module.exports;
    
    if (!exports || !exports.compute_fft) {
      // Fallback to JavaScript implementation
      return this.computeFFTJS(signal);
    }
    
    const size = signal.length;
    const bufferSize = size * 4 * 2; // Real + imaginary
    const buffer = this.getPooledBuffer(bufferSize, 'signal');
    
    try {
      // Copy input signal
      const bufferView = new Float32Array(buffer!);
      bufferView.set(signal, 0);
      
      // Call WASM function
      exports.compute_fft(bufferView.byteOffset, size);
      
      // Extract results
      const real = new Float32Array(bufferView.buffer, 0, size);
      const imag = new Float32Array(bufferView.buffer, size * 4, size);
      
      return {
        real: new Float32Array(real),
        imag: new Float32Array(imag)
      };
    } finally {
      if (buffer) this.returnPooledBuffer(buffer, 'signal');
    }
  }
  
  /**
   * Optimized convolution using WASM
   */
  async convolve2D(
    input: Float32Array,
    kernel: Float32Array,
    width: number,
    height: number,
    kernelSize: number
  ): Promise<Float32Array> {
    const module = await this.loadModule('convolution');
    const exports = module.exports;
    
    if (!exports || !exports.convolve_2d) {
      // Fallback to JavaScript implementation
      return this.convolve2DJS(input, kernel, width, height, kernelSize);
    }
    
    const inputSize = input.length * 4;
    const kernelBufferSize = kernel.length * 4;
    const outputSize = input.length * 4;
    
    const inputBuffer = this.getPooledBuffer(inputSize, 'convolution');
    const kernelBuffer = this.getPooledBuffer(kernelBufferSize, 'convolution');
    const outputBuffer = this.getPooledBuffer(outputSize, 'convolution');
    
    try {
      // Copy input data
      const inputView = new Float32Array(inputBuffer!);
      const kernelView = new Float32Array(kernelBuffer!);
      
      inputView.set(input);
      kernelView.set(kernel);
      
      // Call WASM function
      exports.convolve_2d(
        inputView.byteOffset,
        kernelView.byteOffset,
        width,
        height,
        kernelSize
      );
      
      // Get result
      const outputView = new Float32Array(outputBuffer!, 0, input.length);
      return new Float32Array(outputView);
    } finally {
      if (inputBuffer) this.returnPooledBuffer(inputBuffer, 'convolution');
      if (kernelBuffer) this.returnPooledBuffer(kernelBuffer, 'convolution');
      if (outputBuffer) this.returnPooledBuffer(outputBuffer, 'convolution');
    }
  }
  
  /**
   * Get optimization statistics
   */
  getStats(): {
    loadedModules: number;
    totalModules: number;
    memoryPools: Record<string, { buffers: number; inUse: number }>;
    simdSupport: boolean;
    threadSupport: boolean;
  } {
    const loadedModules = Array.from(this.modules.values()).filter(m => m.loaded).length;
    const totalModules = this.modules.size;
    
    const memoryPools: Record<string, { buffers: number; inUse: number }> = {};
    for (const [name, pool] of this.memoryPools) {
      memoryPools[name] = {
        buffers: pool.buffers.length,
        inUse: pool.inUse.filter(Boolean).length
      };
    }
    
    return {
      loadedModules,
      totalModules,
      memoryPools,
      simdSupport: this.config.enableSIMD,
      threadSupport: this.config.enableThreads
    };
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    // Clear memory pools
    for (const pool of this.memoryPools.values()) {
      pool.buffers.length = 0;
      pool.sizes.length = 0;
      pool.inUse.length = 0;
    }
    
    // Clear modules
    this.modules.clear();
    this.loadingPromises.clear();
  }
  
  // Private helper methods
  
  private detectSIMDSupport(): boolean {
    try {
      return typeof WebAssembly.SIMD !== 'undefined';
    } catch {
      return false;
    }
  }
  
  private detectThreadSupport(): boolean {
    try {
      return typeof SharedArrayBuffer !== 'undefined' && 
             typeof Atomics !== 'undefined';
    } catch {
      return false;
    }
  }
  
  private initializeMemoryPools(): void {
    if (!this.config.enableMemoryPooling) {
      return;
    }
    
    const poolNames = ['default', 'matrix', 'image', 'signal', 'convolution'];
    
    for (const name of poolNames) {
      this.memoryPools.set(name, {
        buffers: [],
        sizes: [],
        inUse: [],
        maxBuffers: this.config.maxPoolSize
      });
    }
  }
  
  private createOptimizedMemory(): WebAssembly.Memory {
    const initialPages = 256; // 16MB initial
    const maximumPages = 1024; // 64MB maximum
    
    return new WebAssembly.Memory({
      initial: initialPages,
      maximum: maximumPages,
      shared: this.config.enableThreads
    });
  }
  
  private createImports(memory: WebAssembly.Memory): WebAssembly.Imports {
    return {
      env: {
        memory,
        abort: () => {
          throw new Error('WASM module aborted');
        },
        console_log: (ptr: number, len: number) => {
          // Helper for WASM debugging
          const bytes = new Uint8Array(memory.buffer, ptr, len);
          const str = new TextDecoder().decode(bytes);
          console.log('[WASM]', str);
        }
      },
      Math: {
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        sqrt: Math.sqrt,
        pow: Math.pow,
        exp: Math.exp,
        log: Math.log
      }
    };
  }
  
  // JavaScript fallback implementations
  
  private multiplyMatricesJS(
    a: Float32Array,
    b: Float32Array,
    rows: number,
    cols: number,
    inner: number
  ): Float32Array {
    const result = new Float32Array(rows * cols);
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        let sum = 0;
        for (let k = 0; k < inner; k++) {
          sum += a[i * inner + k] * b[k * cols + j];
        }
        result[i * cols + j] = sum;
      }
    }
    
    return result;
  }
  
  private processImageDataJS(imageData: ImageData, operation: string): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    
    switch (operation) {
      case 'grayscale':
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = data[i + 1] = data[i + 2] = gray;
        }
        break;
        
      case 'blur':
        // Simple box blur
        const kernel = [1/9, 1/9, 1/9, 1/9, 1/9, 1/9, 1/9, 1/9, 1/9];
        this.applyKernel(data, width, height, kernel, 3);
        break;
        
      default:
        console.warn(`Unsupported image operation: ${operation}`);
    }
    
    return new ImageData(data, width, height);
  }
  
  private applyKernel(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    kernel: number[],
    kernelSize: number
  ): void {
    const original = new Uint8ClampedArray(data);
    const offset = Math.floor(kernelSize / 2);
    
    for (let y = offset; y < height - offset; y++) {
      for (let x = offset; x < width - offset; x++) {
        for (let c = 0; c < 3; c++) { // RGB channels
          let sum = 0;
          for (let ky = 0; ky < kernelSize; ky++) {
            for (let kx = 0; kx < kernelSize; kx++) {
              const py = y + ky - offset;
              const px = x + kx - offset;
              const idx = (py * width + px) * 4 + c;
              sum += original[idx] * kernel[ky * kernelSize + kx];
            }
          }
          data[(y * width + x) * 4 + c] = Math.max(0, Math.min(255, sum));
        }
      }
    }
  }
  
  private computeFFTJS(signal: Float32Array): { real: Float32Array; imag: Float32Array } {
    const N = signal.length;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    
    // Simple DFT implementation (not optimized)
    for (let k = 0; k < N; k++) {
      let realSum = 0;
      let imagSum = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        realSum += signal[n] * Math.cos(angle);
        imagSum += signal[n] * Math.sin(angle);
      }
      
      real[k] = realSum;
      imag[k] = imagSum;
    }
    
    return { real, imag };
  }
  
  private convolve2DJS(
    input: Float32Array,
    kernel: Float32Array,
    width: number,
    height: number,
    kernelSize: number
  ): Float32Array {
    const result = new Float32Array(input.length);
    const offset = Math.floor(kernelSize / 2);
    
    for (let y = offset; y < height - offset; y++) {
      for (let x = offset; x < width - offset; x++) {
        let sum = 0;
        
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const py = y + ky - offset;
            const px = x + kx - offset;
            const inputIdx = py * width + px;
            const kernelIdx = ky * kernelSize + kx;
            
            sum += input[inputIdx] * kernel[kernelIdx];
          }
        }
        
        result[y * width + x] = sum;
      }
    }
    
    return result;
  }
}

/**
 * Global WASM optimizer instance
 */
export const wasmOptimizer = new WasmOptimizer();

/**
 * Initialize WASM modules for the proctoring application
 */
export async function initializeWasmModules(): Promise<void> {
  // Register modules (these would be actual WASM files in production)
  wasmOptimizer.registerModule('matrix-ops', '/wasm/matrix-ops.wasm');
  wasmOptimizer.registerModule('image-processing', '/wasm/image-processing.wasm');
  wasmOptimizer.registerModule('signal-processing', '/wasm/signal-processing.wasm');
  wasmOptimizer.registerModule('convolution', '/wasm/convolution.wasm');
  
  // Preload critical modules
  try {
    await wasmOptimizer.preloadCriticalModules(['matrix-ops', 'image-processing']);
    console.log('Critical WASM modules preloaded successfully');
  } catch (error) {
    console.warn('Failed to preload WASM modules, falling back to JavaScript:', error);
  }
}

/**
 * Utility function to check WASM support
 */
export function checkWasmSupport(): {
  basic: boolean;
  simd: boolean;
  threads: boolean;
  bigInt: boolean;
} {
  return {
    basic: typeof WebAssembly !== 'undefined',
    simd: typeof WebAssembly !== 'undefined' && 'SIMD' in WebAssembly,
    threads: typeof SharedArrayBuffer !== 'undefined' && typeof Atomics !== 'undefined',
    bigInt: typeof BigInt !== 'undefined'
  };
}