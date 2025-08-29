/**
 * Military-Grade Gaze Tracking System
 * Sub-pixel accuracy iris detection and corneal reflection analysis
 * Requirements: 5.3, 7.10
 */

import { VisionError } from './types';

export interface SubPixelIrisData {
  center: { x: number; y: number };
  radius: number;
  subPixelCenter: { x: number; y: number }; // Sub-pixel precision center
  cornealReflections: CornealReflection[];
  confidence: number;
  quality: IrisQuality;
}

export interface CornealReflection {
  position: { x: number; y: number };
  intensity: number;
  size: number;
  confidence: number;
  type: 'primary' | 'secondary';
}

export interface IrisQuality {
  sharpness: number;
  contrast: number;
  visibility: number;
  stability: number;
  overall: number;
}

export interface PrecisionGazeVector {
  x: number;
  y: number;
  z: number;
  confidence: number;
  precision: number; // Sub-pixel precision metric
  deviation: number; // Angular deviation in degrees
}

export interface ScreenIntersection {
  x: number;
  y: number;
  confidence: number;
  onScreen: boolean;
  deviation: number; // Degrees from screen normal
  distance: number; // Estimated distance to screen
}

export interface GazeDeviationAnalysis {
  currentDeviation: number;
  averageDeviation: number;
  maxDeviation: number;
  deviationHistory: number[];
  isWithinThreshold: boolean;
  alertLevel: 'none' | 'low' | 'medium' | 'high';
}

export class MilitaryGradeGazeTracker {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private previousIrisData: Map<string, SubPixelIrisData> = new Map();
  private gazeHistory: PrecisionGazeVector[] = [];
  private deviationHistory: number[] = [];
  
  // Precision thresholds
  private readonly PRECISION_THRESHOLD = 1.0; // 1 degree precision
  private readonly SUB_PIXEL_ACCURACY = 0.1; // 0.1 pixel accuracy
  private readonly CORNEAL_REFLECTION_MIN_SIZE = 2;
  private readonly IRIS_MIN_RADIUS = 8;
  
  constructor() {
    // Only create canvas in browser environment
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
    }
  }

  /**
   * Detect iris with sub-pixel accuracy using advanced image processing
   */
  async detectSubPixelIris(
    imageData: ImageData,
    eyeRegion: { x: number; y: number; width: number; height: number }
  ): Promise<SubPixelIrisData> {
    try {
      // Extract eye region
      const eyeImageData = this.extractEyeRegion(imageData, eyeRegion);
      
      // Apply advanced preprocessing
      const preprocessed = this.advancedPreprocessing(eyeImageData);
      
      // Detect iris boundary with sub-pixel precision
      const irisBoundary = await this.detectIrisBoundary(preprocessed);
      
      // Calculate sub-pixel center using moment analysis
      const subPixelCenter = this.calculateSubPixelCenter(preprocessed, irisBoundary);
      
      // Detect corneal reflections
      const cornealReflections = this.detectCornealReflections(preprocessed, irisBoundary);
      
      // Calculate iris quality metrics
      const quality = this.calculateIrisQuality(preprocessed, irisBoundary);
      
      // Calculate confidence based on multiple factors
      const confidence = this.calculateIrisConfidence(irisBoundary, cornealReflections, quality);
      
      return {
        center: irisBoundary.center,
        radius: irisBoundary.radius,
        subPixelCenter,
        cornealReflections,
        confidence,
        quality
      };
      
    } catch (error) {
      throw new VisionError(`Sub-pixel iris detection failed: ${error}`, {
        code: 'FACE_DETECTION_FAILED',
        details: { eyeRegion, error }
      });
    }
  }

  /**
   * Extract eye region from full image
   */
  private extractEyeRegion(
    imageData: ImageData,
    region: { x: number; y: number; width: number; height: number }
  ): ImageData {
    const { x, y, width, height } = region;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = width;
    canvas.height = height;
    
    // Create temporary canvas with full image
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    tempCtx.putImageData(imageData, 0, 0);
    
    // Extract region
    ctx.drawImage(tempCanvas, x, y, width, height, 0, 0, width, height);
    
    return ctx.getImageData(0, 0, width, height);
  }

  /**
   * Advanced preprocessing for iris detection
   */
  private advancedPreprocessing(imageData: ImageData): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    
    // Convert to grayscale with optimized weights for iris detection
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(
        data[i] * 0.2126 +     // Red
        data[i + 1] * 0.7152 + // Green (enhanced for iris)
        data[i + 2] * 0.0722   // Blue
      );
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
    
    // Apply Gaussian blur for noise reduction
    const blurred = this.gaussianBlur(data, width, height, 1.0);
    
    // Enhance contrast using CLAHE (Contrast Limited Adaptive Histogram Equalization)
    const enhanced = this.applyCLAHE(blurred, width, height);
    
    // Apply unsharp masking for edge enhancement
    const sharpened = this.unsharpMask(enhanced, width, height, 1.5, 0.5);
    
    return new ImageData(sharpened, width, height);
  }

  /**
   * Gaussian blur implementation
   */
  private gaussianBlur(data: Uint8ClampedArray, width: number, height: number, sigma: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(data.length);
    const kernel = this.generateGaussianKernel(sigma);
    const kernelSize = kernel.length;
    const radius = Math.floor(kernelSize / 2);
    
    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let kx = -radius; kx <= radius; kx++) {
          const px = Math.max(0, Math.min(width - 1, x + kx));
          const weight = kernel[kx + radius];
          sum += data[(y * width + px) * 4] * weight;
          weightSum += weight;
        }
        
        const idx = (y * width + x) * 4;
        const value = Math.round(sum / weightSum);
        result[idx] = result[idx + 1] = result[idx + 2] = value;
        result[idx + 3] = data[idx + 3];
      }
    }
    
    // Vertical pass
    const final = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          const py = Math.max(0, Math.min(height - 1, y + ky));
          const weight = kernel[ky + radius];
          sum += result[(py * width + x) * 4] * weight;
          weightSum += weight;
        }
        
        const idx = (y * width + x) * 4;
        const value = Math.round(sum / weightSum);
        final[idx] = final[idx + 1] = final[idx + 2] = value;
        final[idx + 3] = data[idx + 3];
      }
    }
    
    return final;
  }

  /**
   * Generate Gaussian kernel
   */
  private generateGaussianKernel(sigma: number): number[] {
    const size = Math.ceil(sigma * 6) | 1; // Ensure odd size
    const kernel: number[] = [];
    const center = Math.floor(size / 2);
    let sum = 0;
    
    for (let i = 0; i < size; i++) {
      const x = i - center;
      const value = Math.exp(-(x * x) / (2 * sigma * sigma));
      kernel.push(value);
      sum += value;
    }
    
    // Normalize
    return kernel.map(v => v / sum);
  }

  /**
   * Apply Contrast Limited Adaptive Histogram Equalization
   */
  private applyCLAHE(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(data.length);
    const tileSize = 16; // 16x16 tiles
    const clipLimit = 2.0;
    
    for (let ty = 0; ty < height; ty += tileSize) {
      for (let tx = 0; tx < width; tx += tileSize) {
        const tileWidth = Math.min(tileSize, width - tx);
        const tileHeight = Math.min(tileSize, height - ty);
        
        // Calculate histogram for tile
        const histogram = new Array(256).fill(0);
        for (let y = ty; y < ty + tileHeight; y++) {
          for (let x = tx; x < tx + tileWidth; x++) {
            const value = data[(y * width + x) * 4];
            histogram[value]++;
          }
        }
        
        // Apply clip limit
        const totalPixels = tileWidth * tileHeight;
        const clipThreshold = Math.floor((clipLimit * totalPixels) / 256);
        let excess = 0;
        
        for (let i = 0; i < 256; i++) {
          if (histogram[i] > clipThreshold) {
            excess += histogram[i] - clipThreshold;
            histogram[i] = clipThreshold;
          }
        }
        
        // Redistribute excess
        const redistribution = Math.floor(excess / 256);
        for (let i = 0; i < 256; i++) {
          histogram[i] += redistribution;
        }
        
        // Calculate cumulative distribution
        const cdf = new Array(256);
        cdf[0] = histogram[0];
        for (let i = 1; i < 256; i++) {
          cdf[i] = cdf[i - 1] + histogram[i];
        }
        
        // Apply equalization to tile
        for (let y = ty; y < ty + tileHeight; y++) {
          for (let x = tx; x < tx + tileWidth; x++) {
            const idx = (y * width + x) * 4;
            const value = data[idx];
            const newValue = Math.round((cdf[value] * 255) / totalPixels);
            result[idx] = result[idx + 1] = result[idx + 2] = newValue;
            result[idx + 3] = data[idx + 3];
          }
        }
      }
    }
    
    return result;
  }

  /**
   * Apply unsharp masking for edge enhancement
   */
  private unsharpMask(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    amount: number,
    threshold: number
  ): Uint8ClampedArray {
    const result = new Uint8ClampedArray(data.length);
    const blurred = this.gaussianBlur(data, width, height, 2.0);
    
    for (let i = 0; i < data.length; i += 4) {
      const original = data[i];
      const blur = blurred[i];
      const difference = original - blur;
      
      if (Math.abs(difference) > threshold) {
        const enhanced = Math.max(0, Math.min(255, original + amount * difference));
        result[i] = result[i + 1] = result[i + 2] = enhanced;
      } else {
        result[i] = result[i + 1] = result[i + 2] = original;
      }
      result[i + 3] = data[i + 3];
    }
    
    return result;
  }

  /**
   * Detect iris boundary using advanced edge detection
   */
  private async detectIrisBoundary(imageData: ImageData): Promise<{
    center: { x: number; y: number };
    radius: number;
    confidence: number;
  }> {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // Apply Canny edge detection
    const edges = this.cannyEdgeDetection(data, width, height);
    
    // Use Hough circle transform to detect iris boundary
    const circles = this.houghCircleTransform(edges, width, height);
    
    // Select best circle based on iris characteristics
    const bestCircle = this.selectBestIrisCircle(circles, width, height);
    
    if (!bestCircle) {
      throw new Error('No valid iris boundary detected');
    }
    
    return bestCircle;
  }

  /**
   * Canny edge detection implementation
   */
  private cannyEdgeDetection(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const edges = new Uint8ClampedArray(width * height);
    
    // Sobel operators
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    // Calculate gradients
    const gradients: number[] = [];
    const directions: number[] = [];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = data[((y + ky) * width + (x + kx)) * 4];
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            gx += pixel * sobelX[kernelIdx];
            gy += pixel * sobelY[kernelIdx];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const direction = Math.atan2(gy, gx);
        
        gradients[y * width + x] = magnitude;
        directions[y * width + x] = direction;
      }
    }
    
    // Non-maximum suppression
    const suppressed = new Array(width * height).fill(0);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const angle = directions[idx];
        const magnitude = gradients[idx];
        
        // Determine neighboring pixels based on gradient direction
        let neighbor1 = 0, neighbor2 = 0;
        
        if ((angle >= -Math.PI/8 && angle < Math.PI/8) || (angle >= 7*Math.PI/8 || angle < -7*Math.PI/8)) {
          neighbor1 = gradients[idx - 1];
          neighbor2 = gradients[idx + 1];
        } else if ((angle >= Math.PI/8 && angle < 3*Math.PI/8) || (angle >= -7*Math.PI/8 && angle < -5*Math.PI/8)) {
          neighbor1 = gradients[(y-1) * width + (x+1)];
          neighbor2 = gradients[(y+1) * width + (x-1)];
        } else if ((angle >= 3*Math.PI/8 && angle < 5*Math.PI/8) || (angle >= -5*Math.PI/8 && angle < -3*Math.PI/8)) {
          neighbor1 = gradients[(y-1) * width + x];
          neighbor2 = gradients[(y+1) * width + x];
        } else {
          neighbor1 = gradients[(y-1) * width + (x-1)];
          neighbor2 = gradients[(y+1) * width + (x+1)];
        }
        
        if (magnitude >= neighbor1 && magnitude >= neighbor2) {
          suppressed[idx] = magnitude;
        }
      }
    }
    
    // Double thresholding
    const highThreshold = 50;
    const lowThreshold = 20;
    
    for (let i = 0; i < suppressed.length; i++) {
      if (suppressed[i] >= highThreshold) {
        edges[i] = 255;
      } else if (suppressed[i] >= lowThreshold) {
        edges[i] = 128;
      } else {
        edges[i] = 0;
      }
    }
    
    // Edge tracking by hysteresis
    const visited = new Array(width * height).fill(false);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (edges[idx] === 255 && !visited[idx]) {
          this.trackEdge(edges, visited, x, y, width, height);
        }
      }
    }
    
    // Remove weak edges not connected to strong edges
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] === 128) {
        edges[i] = 0;
      }
    }
    
    return edges;
  }

  /**
   * Track edge pixels in Canny edge detection
   */
  private trackEdge(
    edges: Uint8ClampedArray,
    visited: boolean[],
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const stack: Array<{x: number, y: number}> = [{x, y}];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      const idx = current.y * width + current.x;
      
      if (visited[idx]) continue;
      visited[idx] = true;
      
      if (edges[idx] === 128) {
        edges[idx] = 255;
        
        // Check 8-connected neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (!visited[nIdx] && edges[nIdx] === 128) {
                stack.push({x: nx, y: ny});
              }
            }
          }
        }
      }
    }
  }  /**

   * Hough circle transform for iris detection
   */
  private houghCircleTransform(edges: Uint8ClampedArray, width: number, height: number): Array<{
    center: { x: number; y: number };
    radius: number;
    confidence: number;
  }> {
    const circles: Array<{ center: { x: number; y: number }; radius: number; confidence: number }> = [];
    const minRadius = this.IRIS_MIN_RADIUS;
    const maxRadius = Math.min(width, height) / 3;
    
    // Accumulator array for Hough transform
    const accumulator = new Map<string, number>();
    
    // For each edge pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edges[y * width + x] > 0) {
          // Try different radii
          for (let r = minRadius; r <= maxRadius; r += 2) {
            // Try different angles
            for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 16) {
              const centerX = Math.round(x - r * Math.cos(angle));
              const centerY = Math.round(y - r * Math.sin(angle));
              
              if (centerX >= 0 && centerX < width && centerY >= 0 && centerY < height) {
                const key = `${centerX},${centerY},${r}`;
                accumulator.set(key, (accumulator.get(key) || 0) + 1);
              }
            }
          }
        }
      }
    }
    
    // Find peaks in accumulator
    const threshold = Math.PI * minRadius * 0.3; // Minimum votes required
    
    for (const [key, votes] of accumulator.entries()) {
      if (votes >= threshold) {
        const [centerX, centerY, radius] = key.split(',').map(Number);
        const confidence = Math.min(1, votes / (Math.PI * radius));
        
        circles.push({
          center: { x: centerX, y: centerY },
          radius,
          confidence
        });
      }
    }
    
    // Sort by confidence
    circles.sort((a, b) => b.confidence - a.confidence);
    
    return circles.slice(0, 10); // Return top 10 candidates
  }

  /**
   * Select best iris circle based on characteristics
   */
  private selectBestIrisCircle(
    circles: Array<{ center: { x: number; y: number }; radius: number; confidence: number }>,
    width: number,
    height: number
  ): { center: { x: number; y: number }; radius: number; confidence: number } | null {
    if (circles.length === 0) return null;
    
    // Score circles based on multiple criteria
    const scoredCircles = circles.map(circle => {
      let score = circle.confidence;
      
      // Prefer circles in center region
      const centerX = width / 2;
      const centerY = height / 2;
      const distanceFromCenter = Math.sqrt(
        Math.pow(circle.center.x - centerX, 2) + 
        Math.pow(circle.center.y - centerY, 2)
      );
      const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
      const centerScore = 1 - (distanceFromCenter / maxDistance);
      score *= (0.7 + 0.3 * centerScore);
      
      // Prefer reasonable iris sizes
      const expectedRadius = Math.min(width, height) * 0.15; // ~15% of eye region
      const radiusScore = 1 - Math.abs(circle.radius - expectedRadius) / expectedRadius;
      score *= (0.8 + 0.2 * Math.max(0, radiusScore));
      
      return { ...circle, score };
    });
    
    // Return highest scoring circle
    scoredCircles.sort((a, b) => b.score - a.score);
    return scoredCircles[0];
  }

  /**
   * Calculate sub-pixel center using moment analysis
   */
  private calculateSubPixelCenter(
    imageData: ImageData,
    irisBoundary: { center: { x: number; y: number }; radius: number }
  ): { x: number; y: number } {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const { center, radius } = irisBoundary;
    
    let m00 = 0, m10 = 0, m01 = 0;
    let pixelCount = 0;
    
    // Calculate moments within iris region
    const searchRadius = radius + 2;
    for (let y = Math.max(0, center.y - searchRadius); y < Math.min(height, center.y + searchRadius); y++) {
      for (let x = Math.max(0, center.x - searchRadius); x < Math.min(width, center.x + searchRadius); x++) {
        const distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
        
        if (distance <= radius) {
          const intensity = 255 - data[(y * width + x) * 4]; // Invert for dark iris
          const weight = intensity / 255;
          
          m00 += weight;
          m10 += x * weight;
          m01 += y * weight;
          pixelCount++;
        }
      }
    }
    
    if (m00 === 0 || pixelCount < 10) {
      return center; // Fallback to original center
    }
    
    // Calculate centroid with sub-pixel precision
    const subPixelX = m10 / m00;
    const subPixelY = m01 / m00;
    
    // Validate sub-pixel center is reasonable
    const displacement = Math.sqrt(
      Math.pow(subPixelX - center.x, 2) + 
      Math.pow(subPixelY - center.y, 2)
    );
    
    if (displacement > radius * 0.5) {
      return center; // Too far from original center, use original
    }
    
    return { x: subPixelX, y: subPixelY };
  }

  /**
   * Detect corneal reflections (Purkinje images)
   */
  private detectCornealReflections(
    imageData: ImageData,
    irisBoundary: { center: { x: number; y: number }; radius: number }
  ): CornealReflection[] {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const { center, radius } = irisBoundary;
    
    const reflections: CornealReflection[] = [];
    
    // Look for bright spots within and around iris
    const searchRadius = radius * 1.2;
    const brightThreshold = 200; // Minimum brightness for reflection
    
    // Find local maxima that could be reflections
    const candidates: Array<{ x: number; y: number; intensity: number; size: number }> = [];
    
    for (let y = Math.max(1, center.y - searchRadius); y < Math.min(height - 1, center.y + searchRadius); y++) {
      for (let x = Math.max(1, center.x - searchRadius); x < Math.min(width - 1, center.x + searchRadius); x++) {
        const intensity = data[(y * width + x) * 4];
        
        if (intensity >= brightThreshold) {
          // Check if this is a local maximum
          let isLocalMax = true;
          let neighborSum = 0;
          let neighborCount = 0;
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              
              const nx = x + dx;
              const ny = y + dy;
              const neighborIntensity = data[(ny * width + nx) * 4];
              
              if (neighborIntensity >= intensity) {
                isLocalMax = false;
                break;
              }
              
              neighborSum += neighborIntensity;
              neighborCount++;
            }
            if (!isLocalMax) break;
          }
          
          if (isLocalMax && neighborCount > 0) {
            const contrast = intensity - (neighborSum / neighborCount);
            
            if (contrast >= 50) { // Minimum contrast for reflection
              // Estimate reflection size
              const size = this.estimateReflectionSize(data, width, height, x, y, intensity);
              
              if (size >= this.CORNEAL_REFLECTION_MIN_SIZE) {
                candidates.push({ x, y, intensity, size });
              }
            }
          }
        }
      }
    }
    
    // Sort candidates by intensity and select best ones
    candidates.sort((a, b) => b.intensity - a.intensity);
    
    // Convert candidates to reflections with classification
    for (let i = 0; i < Math.min(candidates.length, 4); i++) {
      const candidate = candidates[i];
      const distanceFromCenter = Math.sqrt(
        Math.pow(candidate.x - center.x, 2) + 
        Math.pow(candidate.y - center.y, 2)
      );
      
      // Classify reflection type based on position and characteristics
      const type: 'primary' | 'secondary' = distanceFromCenter < radius * 0.7 ? 'primary' : 'secondary';
      
      // Calculate confidence based on intensity, size, and position
      const intensityScore = Math.min(1, candidate.intensity / 255);
      const sizeScore = Math.min(1, candidate.size / 10);
      const positionScore = distanceFromCenter < radius ? 1 : Math.max(0, 1 - (distanceFromCenter - radius) / radius);
      
      const confidence = (intensityScore * 0.4 + sizeScore * 0.3 + positionScore * 0.3);
      
      reflections.push({
        position: { x: candidate.x, y: candidate.y },
        intensity: candidate.intensity,
        size: candidate.size,
        confidence,
        type
      });
    }
    
    return reflections;
  }

  /**
   * Estimate reflection size using connected component analysis
   */
  private estimateReflectionSize(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    threshold: number
  ): number {
    const visited = new Set<string>();
    const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    let componentSize = 0;
    
    while (stack.length > 0 && componentSize < 100) { // Limit search to prevent runaway
      const { x, y } = stack.pop()!;
      const key = `${x},${y}`;
      
      if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }
      
      const intensity = data[(y * width + x) * 4];
      if (intensity < threshold * 0.8) { // Allow some tolerance
        continue;
      }
      
      visited.add(key);
      componentSize++;
      
      // Add 4-connected neighbors
      stack.push(
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      );
    }
    
    return componentSize;
  }

  /**
   * Calculate iris quality metrics
   */
  private calculateIrisQuality(
    imageData: ImageData,
    irisBoundary: { center: { x: number; y: number }; radius: number }
  ): IrisQuality {
    const data = imageData.data;
    const width = imageData.width;
    const { center, radius } = irisBoundary;
    
    // Calculate sharpness using Laplacian variance
    const sharpness = this.calculateSharpness(data, width, center, radius);
    
    // Calculate contrast using standard deviation
    const contrast = this.calculateContrast(data, width, center, radius);
    
    // Calculate visibility based on iris-sclera boundary clarity
    const visibility = this.calculateVisibility(data, width, center, radius);
    
    // Calculate stability by comparing with previous frame
    const stability = this.calculateStability(center, radius);
    
    const overall = (sharpness * 0.3 + contrast * 0.25 + visibility * 0.25 + stability * 0.2);
    
    return {
      sharpness,
      contrast,
      visibility,
      stability,
      overall
    };
  }

  /**
   * Calculate sharpness using Laplacian variance
   */
  private calculateSharpness(
    data: Uint8ClampedArray,
    width: number,
    center: { x: number; y: number },
    radius: number
  ): number {
    const laplacianKernel = [0, -1, 0, -1, 4, -1, 0, -1, 0];
    let variance = 0;
    let pixelCount = 0;
    let mean = 0;
    
    // First pass: calculate mean
    for (let y = center.y - radius; y <= center.y + radius; y++) {
      for (let x = center.x - radius; x <= center.x + radius; x++) {
        const distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
        
        if (distance <= radius && x >= 1 && x < width - 1 && y >= 1) {
          let laplacian = 0;
          
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixel = data[((y + ky) * width + (x + kx)) * 4];
              laplacian += pixel * laplacianKernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          
          mean += Math.abs(laplacian);
          pixelCount++;
        }
      }
    }
    
    if (pixelCount === 0) return 0;
    mean /= pixelCount;
    
    // Second pass: calculate variance
    pixelCount = 0;
    for (let y = center.y - radius; y <= center.y + radius; y++) {
      for (let x = center.x - radius; x <= center.x + radius; x++) {
        const distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
        
        if (distance <= radius && x >= 1 && x < width - 1 && y >= 1) {
          let laplacian = 0;
          
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixel = data[((y + ky) * width + (x + kx)) * 4];
              laplacian += pixel * laplacianKernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          
          variance += Math.pow(Math.abs(laplacian) - mean, 2);
          pixelCount++;
        }
      }
    }
    
    variance /= pixelCount;
    
    // Normalize to 0-1 range
    return Math.min(1, variance / 1000);
  }

  /**
   * Calculate contrast using standard deviation
   */
  private calculateContrast(
    data: Uint8ClampedArray,
    width: number,
    center: { x: number; y: number },
    radius: number
  ): number {
    let sum = 0;
    let sumSquares = 0;
    let pixelCount = 0;
    
    for (let y = center.y - radius; y <= center.y + radius; y++) {
      for (let x = center.x - radius; x <= center.x + radius; x++) {
        const distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
        
        if (distance <= radius && x >= 0 && x < width && y >= 0) {
          const intensity = data[(y * width + x) * 4];
          sum += intensity;
          sumSquares += intensity * intensity;
          pixelCount++;
        }
      }
    }
    
    if (pixelCount === 0) return 0;
    
    const mean = sum / pixelCount;
    const variance = (sumSquares / pixelCount) - (mean * mean);
    const stdDev = Math.sqrt(variance);
    
    // Normalize to 0-1 range
    return Math.min(1, stdDev / 64);
  }

  /**
   * Calculate visibility based on iris-sclera boundary clarity
   */
  private calculateVisibility(
    data: Uint8ClampedArray,
    width: number,
    center: { x: number; y: number },
    radius: number
  ): number {
    let boundaryStrength = 0;
    let sampleCount = 0;
    
    // Sample points around iris boundary
    const numSamples = 32;
    for (let i = 0; i < numSamples; i++) {
      const angle = (2 * Math.PI * i) / numSamples;
      const boundaryX = Math.round(center.x + radius * Math.cos(angle));
      const boundaryY = Math.round(center.y + radius * Math.sin(angle));
      
      // Sample inside and outside boundary
      const insideX = Math.round(center.x + (radius * 0.8) * Math.cos(angle));
      const insideY = Math.round(center.y + (radius * 0.8) * Math.sin(angle));
      const outsideX = Math.round(center.x + (radius * 1.2) * Math.cos(angle));
      const outsideY = Math.round(center.y + (radius * 1.2) * Math.sin(angle));
      
      if (insideX >= 0 && insideX < width && insideY >= 0 &&
          outsideX >= 0 && outsideX < width && outsideY >= 0) {
        
        const insideIntensity = data[(insideY * width + insideX) * 4];
        const outsideIntensity = data[(outsideY * width + outsideX) * 4];
        
        boundaryStrength += Math.abs(outsideIntensity - insideIntensity);
        sampleCount++;
      }
    }
    
    if (sampleCount === 0) return 0;
    
    const avgBoundaryStrength = boundaryStrength / sampleCount;
    
    // Normalize to 0-1 range
    return Math.min(1, avgBoundaryStrength / 100);
  }

  /**
   * Calculate stability by comparing with previous frame
   */
  private calculateStability(center: { x: number; y: number }, radius: number): number {
    const key = 'iris';
    const previous = this.previousIrisData.get(key);
    
    if (!previous) {
      // Store current data for next frame
      this.previousIrisData.set(key, {
        center,
        radius,
        subPixelCenter: center,
        cornealReflections: [],
        confidence: 0,
        quality: {
          sharpness: 0,
          contrast: 0,
          visibility: 0,
          stability: 1,
          overall: 0
        }
      });
      return 1; // Perfect stability for first frame
    }
    
    // Calculate position stability
    const positionDiff = Math.sqrt(
      Math.pow(center.x - previous.center.x, 2) + 
      Math.pow(center.y - previous.center.y, 2)
    );
    
    // Calculate size stability
    const sizeDiff = Math.abs(radius - previous.radius);
    
    // Combine stability metrics
    const positionStability = Math.max(0, 1 - positionDiff / 10);
    const sizeStability = Math.max(0, 1 - sizeDiff / 5);
    
    const stability = (positionStability + sizeStability) / 2;
    
    // Update stored data
    this.previousIrisData.set(key, {
      center,
      radius,
      subPixelCenter: center,
      cornealReflections: [],
      confidence: 0,
      quality: {
        sharpness: 0,
        contrast: 0,
        visibility: 0,
        stability,
        overall: 0
      }
    });
    
    return stability;
  }

  /**
   * Calculate iris confidence based on multiple factors
   */
  private calculateIrisConfidence(
    irisBoundary: { center: { x: number; y: number }; radius: number; confidence: number },
    cornealReflections: CornealReflection[],
    quality: IrisQuality
  ): number {
    // Base confidence from boundary detection
    let confidence = irisBoundary.confidence * 0.4;
    
    // Quality contribution
    confidence += quality.overall * 0.3;
    
    // Corneal reflection contribution
    const reflectionScore = cornealReflections.length > 0 
      ? Math.min(1, cornealReflections.reduce((sum, r) => sum + r.confidence, 0) / 2)
      : 0;
    confidence += reflectionScore * 0.2;
    
    // Size reasonableness
    const sizeScore = irisBoundary.radius >= this.IRIS_MIN_RADIUS && irisBoundary.radius <= 50 ? 1 : 0.5;
    confidence += sizeScore * 0.1;
    
    return Math.min(1, confidence);
  }

  /**
   * Calculate precise gaze vector from iris data
   */
  calculatePrecisionGazeVector(
    leftIris: SubPixelIrisData,
    rightIris: SubPixelIrisData,
    headPose: { yaw: number; pitch: number; roll: number }
  ): PrecisionGazeVector {
    // Use corneal reflections for enhanced accuracy
    const leftGazeVector = this.calculateEyeGazeFromReflections(leftIris);
    const rightGazeVector = this.calculateEyeGazeFromReflections(rightIris);
    
    // Combine vectors with confidence weighting
    const totalConfidence = leftIris.confidence + rightIris.confidence;
    
    if (totalConfidence === 0) {
      return { x: 0, y: 0, z: -1, confidence: 0, precision: 0, deviation: 180 };
    }
    
    const leftWeight = leftIris.confidence / totalConfidence;
    const rightWeight = rightIris.confidence / totalConfidence;
    
    const combinedX = leftGazeVector.x * leftWeight + rightGazeVector.x * rightWeight;
    const combinedY = leftGazeVector.y * leftWeight + rightGazeVector.y * rightWeight;
    const combinedZ = leftGazeVector.z * leftWeight + rightGazeVector.z * rightWeight;
    
    // Normalize
    const magnitude = Math.sqrt(combinedX * combinedX + combinedY * combinedY + combinedZ * combinedZ);
    const normalizedVector = {
      x: combinedX / magnitude,
      y: combinedY / magnitude,
      z: combinedZ / magnitude
    };
    
    // Compensate for head pose
    const compensatedVector = this.compensateForHeadPose(normalizedVector, headPose);
    
    // Calculate precision based on iris quality and reflection data
    const precision = this.calculateGazePrecision(leftIris, rightIris);
    
    // Calculate angular deviation from screen normal
    const deviation = Math.acos(Math.abs(compensatedVector.z)) * (180 / Math.PI);
    
    // Combined confidence
    const confidence = Math.min(1, totalConfidence / 2);
    
    return {
      x: compensatedVector.x,
      y: compensatedVector.y,
      z: compensatedVector.z,
      confidence,
      precision,
      deviation
    };
  }

  /**
   * Calculate eye gaze vector using corneal reflections
   */
  private calculateEyeGazeFromReflections(irisData: SubPixelIrisData): { x: number; y: number; z: number } {
    const { subPixelCenter, cornealReflections, radius } = irisData;
    
    // If we have corneal reflections, use them for enhanced accuracy
    if (cornealReflections.length > 0) {
      const primaryReflection = cornealReflections.find(r => r.type === 'primary') || cornealReflections[0];
      
      // Calculate vector from reflection to iris center
      const reflectionVector = {
        x: subPixelCenter.x - primaryReflection.position.x,
        y: subPixelCenter.y - primaryReflection.position.y
      };
      
      // Convert to 3D gaze vector using corneal geometry
      const gazeAngleX = Math.atan2(reflectionVector.x, radius * 2);
      const gazeAngleY = Math.atan2(reflectionVector.y, radius * 2);
      
      return {
        x: Math.sin(gazeAngleX),
        y: Math.sin(gazeAngleY),
        z: -Math.cos(Math.sqrt(gazeAngleX * gazeAngleX + gazeAngleY * gazeAngleY))
      };
    }
    
    // Fallback to iris center displacement
    const centerDisplacement = {
      x: subPixelCenter.x - radius,
      y: subPixelCenter.y - radius
    };
    
    const gazeAngleX = Math.atan2(centerDisplacement.x, radius * 3);
    const gazeAngleY = Math.atan2(centerDisplacement.y, radius * 3);
    
    return {
      x: Math.sin(gazeAngleX),
      y: Math.sin(gazeAngleY),
      z: -Math.cos(Math.sqrt(gazeAngleX * gazeAngleX + gazeAngleY * gazeAngleY))
    };
  }

  /**
   * Compensate gaze vector for head pose
   */
  private compensateForHeadPose(
    gazeVector: { x: number; y: number; z: number },
    headPose: { yaw: number; pitch: number; roll: number }
  ): { x: number; y: number; z: number } {
    // Convert angles to radians
    const yaw = headPose.yaw * Math.PI / 180;
    const pitch = headPose.pitch * Math.PI / 180;
    const roll = headPose.roll * Math.PI / 180;
    
    // Create rotation matrices
    const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
    const cosRoll = Math.cos(roll), sinRoll = Math.sin(roll);
    
    // Apply rotations (yaw -> pitch -> roll)
    let x = gazeVector.x;
    let y = gazeVector.y;
    let z = gazeVector.z;
    
    // Yaw rotation (around Y-axis)
    const x1 = x * cosYaw + z * sinYaw;
    const z1 = -x * sinYaw + z * cosYaw;
    
    // Pitch rotation (around X-axis)
    const y2 = y * cosPitch - z1 * sinPitch;
    const z2 = y * sinPitch + z1 * cosPitch;
    
    // Roll rotation (around Z-axis)
    const x3 = x1 * cosRoll - y2 * sinRoll;
    const y3 = x1 * sinRoll + y2 * cosRoll;
    
    return { x: x3, y: y3, z: z2 };
  }

  /**
   * Calculate gaze precision metric
   */
  private calculateGazePrecision(leftIris: SubPixelIrisData, rightIris: SubPixelIrisData): number {
    // Base precision from iris quality
    const avgQuality = (leftIris.quality.overall + rightIris.quality.overall) / 2;
    
    // Precision from corneal reflections
    const leftReflectionScore = leftIris.cornealReflections.length > 0 
      ? leftIris.cornealReflections.reduce((sum, r) => sum + r.confidence, 0) / leftIris.cornealReflections.length
      : 0;
    const rightReflectionScore = rightIris.cornealReflections.length > 0
      ? rightIris.cornealReflections.reduce((sum, r) => sum + r.confidence, 0) / rightIris.cornealReflections.length
      : 0;
    const avgReflectionScore = (leftReflectionScore + rightReflectionScore) / 2;
    
    // Sub-pixel accuracy contribution
    const subPixelScore = 1.0; // Assume perfect sub-pixel accuracy for now
    
    // Combine metrics
    return (avgQuality * 0.4 + avgReflectionScore * 0.4 + subPixelScore * 0.2);
  }

  /**
   * Calculate real-time screen intersection with high precision
   */
  calculateScreenIntersection(
    gazeVector: PrecisionGazeVector,
    screenGeometry: {
      width: number;
      height: number;
      distance: number; // mm
      position: { x: number; y: number; z: number };
    }
  ): ScreenIntersection {
    const { width, height, distance, position } = screenGeometry;
    
    // Calculate intersection with screen plane
    if (Math.abs(gazeVector.z) < 0.001) {
      // Gaze parallel to screen
      return {
        x: width / 2,
        y: height / 2,
        confidence: 0.1,
        onScreen: false,
        deviation: 90,
        distance: distance
      };
    }
    
    // Calculate intersection point
    const t = (position.z - distance) / gazeVector.z;
    const intersectionX = position.x + gazeVector.x * t;
    const intersectionY = position.y + gazeVector.y * t;
    
    // Convert to screen coordinates
    const screenX = intersectionX + width / 2;
    const screenY = intersectionY + height / 2;
    
    // Check if on screen
    const onScreen = screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height;
    
    // Calculate deviation from screen normal
    const deviation = Math.acos(Math.abs(gazeVector.z)) * (180 / Math.PI);
    
    // Adjust confidence based on precision and deviation
    let confidence = gazeVector.confidence * gazeVector.precision;
    
    // Reduce confidence for high deviations
    if (deviation > 30) {
      confidence *= Math.max(0.1, 1 - (deviation - 30) / 60);
    }
    
    return {
      x: screenX,
      y: screenY,
      confidence,
      onScreen,
      deviation,
      distance: t
    };
  }

  /**
   * Analyze gaze deviation with 1-degree precision
   */
  analyzeGazeDeviation(gazeVector: PrecisionGazeVector): GazeDeviationAnalysis {
    const currentDeviation = gazeVector.deviation;
    
    // Add to history
    this.deviationHistory.push(currentDeviation);
    
    // Keep only last 100 samples (about 3-4 seconds at 30fps)
    if (this.deviationHistory.length > 100) {
      this.deviationHistory.shift();
    }
    
    // Calculate statistics
    const averageDeviation = this.deviationHistory.reduce((sum, d) => sum + d, 0) / this.deviationHistory.length;
    const maxDeviation = Math.max(...this.deviationHistory);
    
    // Determine if within threshold
    const isWithinThreshold = currentDeviation <= this.PRECISION_THRESHOLD;
    
    // Determine alert level
    let alertLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    
    if (currentDeviation > 5) {
      alertLevel = 'high';
    } else if (currentDeviation > 3) {
      alertLevel = 'medium';
    } else if (currentDeviation > this.PRECISION_THRESHOLD) {
      alertLevel = 'low';
    }
    
    return {
      currentDeviation,
      averageDeviation,
      maxDeviation,
      deviationHistory: [...this.deviationHistory],
      isWithinThreshold,
      alertLevel
    };
  }

  /**
   * Get confidence scoring for gaze accuracy
   */
  getGazeConfidenceScore(
    gazeVector: PrecisionGazeVector,
    screenIntersection: ScreenIntersection
  ): {
    overall: number;
    precision: number;
    stability: number;
    onScreen: number;
    deviation: number;
  } {
    // Precision score
    const precisionScore = gazeVector.precision;
    
    // Stability score based on recent gaze history
    const stabilityScore = this.calculateGazeStability();
    
    // On-screen score
    const onScreenScore = screenIntersection.onScreen ? 1 : 0;
    
    // Deviation score (1-degree precision requirement)
    const deviationScore = Math.max(0, 1 - gazeVector.deviation / this.PRECISION_THRESHOLD);
    
    // Overall confidence
    const overall = (
      precisionScore * 0.3 +
      stabilityScore * 0.25 +
      onScreenScore * 0.25 +
      deviationScore * 0.2
    );
    
    return {
      overall,
      precision: precisionScore,
      stability: stabilityScore,
      onScreen: onScreenScore,
      deviation: deviationScore
    };
  }

  /**
   * Calculate gaze stability from recent history
   */
  private calculateGazeStability(): number {
    if (this.gazeHistory.length < 5) {
      return 0.5; // Neutral stability for insufficient data
    }
    
    const recent = this.gazeHistory.slice(-10);
    let totalVariation = 0;
    
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      
      const variation = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) +
        Math.pow(curr.y - prev.y, 2) +
        Math.pow(curr.z - prev.z, 2)
      );
      
      totalVariation += variation;
    }
    
    const avgVariation = totalVariation / (recent.length - 1);
    
    // Convert to stability score (lower variation = higher stability)
    return Math.max(0, 1 - avgVariation / 0.1);
  }

  /**
   * Add gaze vector to history for stability analysis
   */
  addGazeToHistory(gazeVector: PrecisionGazeVector): void {
    this.gazeHistory.push(gazeVector);
    
    // Keep only last 100 samples
    if (this.gazeHistory.length > 100) {
      this.gazeHistory.shift();
    }
  }

  /**
   * Reset tracking history
   */
  resetHistory(): void {
    this.gazeHistory = [];
    this.deviationHistory = [];
    this.previousIrisData.clear();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.resetHistory();
    if (this.canvas) {
      this.canvas.remove();
    }
  }
}