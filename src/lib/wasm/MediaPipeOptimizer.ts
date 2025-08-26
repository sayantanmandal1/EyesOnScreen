/**
 * MediaPipe optimization wrapper using WebAssembly
 * Optimizes MediaPipe model loading and execution with memory pooling and lazy loading
 */

import { wasmOptimizer } from './WasmOptimizer';

export interface MediaPipeConfig {
  modelPath: string;
  wasmPath?: string;
  enableGPU: boolean;
  maxNumFaces: number;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
  refineLandmarks: boolean;
}

export interface OptimizedMediaPipeModel {
  name: string;
  config: MediaPipeConfig;
  model?: any; // MediaPipe model instance
  loaded: boolean;
  loading: boolean;
  lastUsed: number;
}

export class MediaPipeOptimizer {
  private models = new Map<string, OptimizedMediaPipeModel>();
  private loadingPromises = new Map<string, Promise<OptimizedMediaPipeModel>>();
  private memoryPool = new Map<string, ArrayBuffer[]>();
  private maxCacheSize = 3; // Maximum number of cached models
  private cacheTimeout = 300000; // 5 minutes
  private cleanupInterval: number | null = null;
  
  constructor() {
    this.startCleanupTimer();
  }
  
  /**
   * Register a MediaPipe model for optimized loading
   */
  registerModel(name: string, config: MediaPipeConfig): void {
    this.models.set(name, {
      name,
      config,
      loaded: false,
      loading: false,
      lastUsed: 0
    });
  }
  
  /**
   * Load and optimize a MediaPipe model
   */
  async loadModel(name: string): Promise<OptimizedMediaPipeModel> {
    const modelInfo = this.models.get(name);
    if (!modelInfo) {
      throw new Error(`Model ${name} not registered`);
    }
    
    if (modelInfo.loaded && modelInfo.model) {
      modelInfo.lastUsed = Date.now();
      return modelInfo;
    }
    
    // Check if already loading
    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name)!;
    }
    
    // Start loading
    const loadingPromise = this.loadModelInternal(modelInfo);
    this.loadingPromises.set(name, loadingPromise);
    
    try {
      const loadedModel = await loadingPromise;
      this.loadingPromises.delete(name);
      return loadedModel;
    } catch (error) {
      this.loadingPromises.delete(name);
      throw error;
    }
  }
  
  /**
   * Process frame with optimized MediaPipe model
   */
  async processFrame(
    modelName: string,
    imageData: ImageData | HTMLVideoElement | HTMLCanvasElement
  ): Promise<any> {
    const model = await this.loadModel(modelName);
    
    if (!model.model) {
      throw new Error(`Model ${modelName} not loaded`);
    }
    
    // Update last used timestamp
    model.lastUsed = Date.now();
    
    // Get optimized buffer for processing
    const buffer = this.getOptimizedBuffer(imageData, modelName);
    
    try {
      // Process with MediaPipe
      const results = await this.processWithOptimizations(model.model, imageData, buffer);
      return results;
    } finally {
      // Return buffer to pool
      this.returnBuffer(buffer, modelName);
    }
  }
  
  /**
   * Preload critical models
   */
  async preloadModels(modelNames: string[]): Promise<void> {
    const loadPromises = modelNames.map(name => this.loadModel(name));
    await Promise.all(loadPromises);
  }
  
  /**
   * Get model statistics
   */
  getStats(): {
    loadedModels: number;
    totalModels: number;
    memoryUsage: number;
    cacheHitRate: number;
  } {
    const loadedModels = Array.from(this.models.values()).filter(m => m.loaded).length;
    const totalModels = this.models.size;
    
    let memoryUsage = 0;
    for (const buffers of this.memoryPool.values()) {
      memoryUsage += buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
    }
    
    return {
      loadedModels,
      totalModels,
      memoryUsage,
      cacheHitRate: 0.95 // Placeholder - would be calculated from actual usage
    };
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    // Clear models
    for (const model of this.models.values()) {
      if (model.model && typeof model.model.close === 'function') {
        model.model.close();
      }
    }
    this.models.clear();
    
    // Clear memory pools
    this.memoryPool.clear();
    
    // Clear loading promises
    this.loadingPromises.clear();
    
    // Stop cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  // Private methods
  
  private async loadModelInternal(modelInfo: OptimizedMediaPipeModel): Promise<OptimizedMediaPipeModel> {
    modelInfo.loading = true;
    
    try {
      // Initialize WASM if needed
      if (modelInfo.config.wasmPath) {
        await this.initializeWasm(modelInfo.config.wasmPath);
      }
      
      // Load MediaPipe model (this would use actual MediaPipe API)
      const model = await this.createMediaPipeModel(modelInfo.config);
      
      modelInfo.model = model;
      modelInfo.loaded = true;
      modelInfo.loading = false;
      modelInfo.lastUsed = Date.now();
      
      // Manage cache size
      this.manageCacheSize();
      
      console.log(`MediaPipe model ${modelInfo.name} loaded successfully`);
      
      return modelInfo;
    } catch (error) {
      modelInfo.loading = false;
      console.error(`Failed to load MediaPipe model ${modelInfo.name}:`, error);
      throw error;
    }
  }
  
  private async initializeWasm(wasmPath: string): Promise<void> {
    // Register and load WASM module for MediaPipe
    wasmOptimizer.registerModule('mediapipe', wasmPath);
    await wasmOptimizer.loadModule('mediapipe');
  }
  
  private async createMediaPipeModel(config: MediaPipeConfig): Promise<any> {
    // This would create actual MediaPipe model
    // For now, return a mock model
    return {
      process: async (input: any) => {
        // Mock processing
        return {
          multiFaceLandmarks: [],
          multiFaceGeometry: []
        };
      },
      close: () => {
        // Cleanup
      }
    };
  }
  
  private getOptimizedBuffer(
    imageData: ImageData | HTMLVideoElement | HTMLCanvasElement,
    modelName: string
  ): ArrayBuffer {
    let width: number, height: number;
    
    if (imageData instanceof ImageData) {
      width = imageData.width;
      height = imageData.height;
    } else {
      width = imageData.width || imageData.videoWidth || 640;
      height = imageData.height || imageData.videoHeight || 480;
    }
    
    const bufferSize = width * height * 4; // RGBA
    
    // Get buffer from pool
    const poolKey = `${modelName}_${bufferSize}`;
    let buffers = this.memoryPool.get(poolKey);
    
    if (!buffers) {
      buffers = [];
      this.memoryPool.set(poolKey, buffers);
    }
    
    // Find available buffer
    for (const buffer of buffers) {
      if (buffer.byteLength >= bufferSize) {
        return buffer;
      }
    }
    
    // Create new buffer
    const newBuffer = new ArrayBuffer(bufferSize);
    buffers.push(newBuffer);
    
    return newBuffer;
  }
  
  private returnBuffer(buffer: ArrayBuffer, modelName: string): void {
    // Buffer is automatically returned to pool since we're using references
    // In a real implementation, we might mark it as available
  }
  
  private async processWithOptimizations(
    model: any,
    input: ImageData | HTMLVideoElement | HTMLCanvasElement,
    buffer: ArrayBuffer
  ): Promise<any> {
    // Convert input to optimized format if needed
    const optimizedInput = await this.optimizeInput(input, buffer);
    
    // Process with MediaPipe
    const results = await model.process(optimizedInput);
    
    // Post-process results with WASM optimizations if available
    return this.optimizeResults(results);
  }
  
  private async optimizeInput(
    input: ImageData | HTMLVideoElement | HTMLCanvasElement,
    buffer: ArrayBuffer
  ): Promise<any> {
    if (input instanceof ImageData) {
      // Copy to optimized buffer
      const view = new Uint8ClampedArray(buffer, 0, input.data.length);
      view.set(input.data);
      
      return {
        data: view,
        width: input.width,
        height: input.height
      };
    }
    
    // For video/canvas elements, we'd extract ImageData
    return input;
  }
  
  private async optimizeResults(results: any): Promise<any> {
    // Apply WASM optimizations to results if available
    if (results.multiFaceLandmarks && wasmOptimizer.isModuleLoaded('mediapipe')) {
      // Use WASM for landmark processing
      const exports = wasmOptimizer.getModuleExports('mediapipe');
      if (exports && exports.optimize_landmarks) {
        // Process landmarks with WASM
        for (const landmarks of results.multiFaceLandmarks) {
          // Convert to Float32Array for WASM processing
          const landmarkArray = new Float32Array(landmarks.length * 3);
          for (let i = 0; i < landmarks.length; i++) {
            landmarkArray[i * 3] = landmarks[i].x;
            landmarkArray[i * 3 + 1] = landmarks[i].y;
            landmarkArray[i * 3 + 2] = landmarks[i].z || 0;
          }
          
          // Process with WASM (mock call)
          exports.optimize_landmarks(landmarkArray.byteOffset, landmarks.length);
          
          // Update landmarks
          for (let i = 0; i < landmarks.length; i++) {
            landmarks[i].x = landmarkArray[i * 3];
            landmarks[i].y = landmarkArray[i * 3 + 1];
            landmarks[i].z = landmarkArray[i * 3 + 2];
          }
        }
      }
    }
    
    return results;
  }
  
  private manageCacheSize(): void {
    const loadedModels = Array.from(this.models.values())
      .filter(m => m.loaded)
      .sort((a, b) => a.lastUsed - b.lastUsed);
    
    // Remove oldest models if cache is full
    while (loadedModels.length > this.maxCacheSize) {
      const oldestModel = loadedModels.shift()!;
      if (oldestModel.model && typeof oldestModel.model.close === 'function') {
        oldestModel.model.close();
      }
      oldestModel.model = undefined;
      oldestModel.loaded = false;
      
      console.log(`Unloaded MediaPipe model ${oldestModel.name} from cache`);
    }
  }
  
  private startCleanupTimer(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.performCleanup();
    }, 60000); // Cleanup every minute
  }
  
  private performCleanup(): void {
    const now = Date.now();
    
    // Unload models that haven't been used recently
    for (const model of this.models.values()) {
      if (model.loaded && now - model.lastUsed > this.cacheTimeout) {
        if (model.model && typeof model.model.close === 'function') {
          model.model.close();
        }
        model.model = undefined;
        model.loaded = false;
        
        console.log(`Cleaned up unused MediaPipe model ${model.name}`);
      }
    }
    
    // Clean up memory pools
    for (const [key, buffers] of this.memoryPool.entries()) {
      if (buffers.length > 5) { // Keep max 5 buffers per pool
        this.memoryPool.set(key, buffers.slice(0, 5));
      }
    }
  }
}

/**
 * Global MediaPipe optimizer instance
 */
export const mediaPipeOptimizer = new MediaPipeOptimizer();

/**
 * Initialize optimized MediaPipe models
 */
export async function initializeOptimizedMediaPipe(): Promise<void> {
  // Register common MediaPipe models
  mediaPipeOptimizer.registerModel('face_mesh', {
    modelPath: '/models/face_mesh.tflite',
    wasmPath: '/wasm/mediapipe.wasm',
    enableGPU: true,
    maxNumFaces: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    refineLandmarks: true
  });
  
  mediaPipeOptimizer.registerModel('face_detection', {
    modelPath: '/models/face_detection.tflite',
    enableGPU: true,
    maxNumFaces: 5,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
    refineLandmarks: false
  });
  
  // Preload critical models
  try {
    await mediaPipeOptimizer.preloadModels(['face_mesh']);
    console.log('Critical MediaPipe models preloaded');
  } catch (error) {
    console.warn('Failed to preload MediaPipe models:', error);
  }
}