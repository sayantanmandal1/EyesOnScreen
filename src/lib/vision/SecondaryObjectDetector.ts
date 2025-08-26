/**
 * Secondary object detection for faces and phone-like devices
 */

export interface FaceDetectionResult {
  detected: boolean;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  frameCount: number; // Consecutive frames detected
}

export interface DeviceDetectionResult {
  detected: boolean;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  motionScore: number;
  highlightScore: number;
  frameCount: number; // Consecutive frames detected
}

export interface SecondaryObjectDetection {
  secondaryFaces: FaceDetectionResult[];
  deviceLikeObjects: DeviceDetectionResult[];
  totalSecondaryFaces: number;
  totalDeviceLikeObjects: number;
}

export interface SecondaryObjectDetectorConfig {
  faceConfidenceThreshold: number;
  deviceConfidenceThreshold: number;
  minConsecutiveFrames: number;
  motionThreshold: number;
  highlightThreshold: number;
  rectangleAspectRatioMin: number;
  rectangleAspectRatioMax: number;
  minObjectSize: number;
  maxObjectSize: number;
}

interface DetectedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  framesSeen: number;
  lastSeen: number;
  motionHistory: number[];
  highlightHistory: number[];
}

export class SecondaryObjectDetector {
  private config: SecondaryObjectDetectorConfig;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private previousFrame: ImageData | null = null;
  private detectedFaces: Map<string, DetectedRegion> = new Map();
  private detectedDevices: Map<string, DetectedRegion> = new Map();
  private frameCounter = 0;

  constructor(config: Partial<SecondaryObjectDetectorConfig> = {}) {
    this.config = {
      faceConfidenceThreshold: 0.6,
      deviceConfidenceThreshold: 0.5,
      minConsecutiveFrames: 5,
      motionThreshold: 0.3,
      highlightThreshold: 0.7,
      rectangleAspectRatioMin: 0.4, // Phone-like ratio
      rectangleAspectRatioMax: 0.8,
      minObjectSize: 0.02, // 2% of frame
      maxObjectSize: 0.3,  // 30% of frame
      ...config
    };

    // Create canvas for image processing
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Detect secondary objects in video frame
   */
  detectObjects(videoElement: HTMLVideoElement, primaryFaceBounds?: { x: number; y: number; width: number; height: number }): SecondaryObjectDetection {
    this.frameCounter++;
    
    // Set canvas size to match video
    this.canvas.width = videoElement.videoWidth;
    this.canvas.height = videoElement.videoHeight;

    // Draw video frame to canvas
    this.ctx.drawImage(videoElement, 0, 0);
    
    // Get image data
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Detect secondary faces
    const secondaryFaces = this.detectSecondaryFaces(imageData, primaryFaceBounds);
    
    // Detect device-like objects
    const deviceLikeObjects = this.detectDeviceLikeObjects(imageData);
    
    // Update previous frame for motion detection
    this.previousFrame = imageData;
    
    // Clean up old detections
    this.cleanupOldDetections();

    return {
      secondaryFaces,
      deviceLikeObjects,
      totalSecondaryFaces: secondaryFaces.filter(f => f.detected).length,
      totalDeviceLikeObjects: deviceLikeObjects.filter(d => d.detected).length
    };
  }

  /**
   * Detect additional faces in the frame (excluding primary face)
   */
  private detectSecondaryFaces(imageData: ImageData, primaryFaceBounds?: { x: number; y: number; width: number; height: number }): FaceDetectionResult[] {
    const { data, width, height } = imageData;
    const faces: FaceDetectionResult[] = [];
    
    // Simple face detection using skin color and facial feature patterns
    const skinRegions = this.detectSkinRegions(data, width, height);
    
    for (const region of skinRegions) {
      // Skip if this region overlaps with primary face
      if (primaryFaceBounds && this.regionsOverlap(region, primaryFaceBounds, 0.3)) {
        continue;
      }
      
      // Check if region has face-like characteristics
      const faceConfidence = this.calculateFaceConfidence(data, width, height, region);
      
      if (faceConfidence >= this.config.faceConfidenceThreshold) {
        const regionId = `${Math.round(region.x)}_${Math.round(region.y)}`;
        
        // Update or create face tracking
        const existingFace = this.detectedFaces.get(regionId);
        if (existingFace) {
          existingFace.framesSeen++;
          existingFace.lastSeen = this.frameCounter;
          existingFace.confidence = Math.max(existingFace.confidence, faceConfidence);
        } else {
          this.detectedFaces.set(regionId, {
            ...region,
            confidence: faceConfidence,
            framesSeen: 1,
            lastSeen: this.frameCounter,
            motionHistory: [],
            highlightHistory: []
          });
        }
        
        const trackedFace = this.detectedFaces.get(regionId)!;
        
        faces.push({
          detected: trackedFace.framesSeen >= this.config.minConsecutiveFrames,
          confidence: faceConfidence,
          boundingBox: {
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height
          },
          frameCount: trackedFace.framesSeen
        });
      }
    }
    
    return faces;
  }

  /**
   * Detect phone-like objects using rectangle and highlight heuristics
   */
  private detectDeviceLikeObjects(imageData: ImageData): DeviceDetectionResult[] {
    const { data, width, height } = imageData;
    const devices: DeviceDetectionResult[] = [];
    
    // Detect rectangular regions with high contrast edges
    const rectangularRegions = this.detectRectangularRegions(data, width, height);
    
    for (const region of rectangularRegions) {
      // Calculate motion score
      const motionScore = this.calculateMotionScore(imageData, region);
      
      // Calculate highlight score (specular reflections)
      const highlightScore = this.calculateHighlightScore(data, width, height, region);
      
      // Calculate device confidence based on shape, motion, and highlights
      const deviceConfidence = this.calculateDeviceConfidence(region, motionScore, highlightScore);
      
      if (deviceConfidence >= this.config.deviceConfidenceThreshold) {
        const regionId = `${Math.round(region.x)}_${Math.round(region.y)}`;
        
        // Update or create device tracking
        const existingDevice = this.detectedDevices.get(regionId);
        if (existingDevice) {
          existingDevice.framesSeen++;
          existingDevice.lastSeen = this.frameCounter;
          existingDevice.confidence = Math.max(existingDevice.confidence, deviceConfidence);
          existingDevice.motionHistory.push(motionScore);
          existingDevice.highlightHistory.push(highlightScore);
          
          // Keep only recent history
          if (existingDevice.motionHistory.length > 10) {
            existingDevice.motionHistory.shift();
            existingDevice.highlightHistory.shift();
          }
        } else {
          this.detectedDevices.set(regionId, {
            ...region,
            confidence: deviceConfidence,
            framesSeen: 1,
            lastSeen: this.frameCounter,
            motionHistory: [motionScore],
            highlightHistory: [highlightScore]
          });
        }
        
        const trackedDevice = this.detectedDevices.get(regionId)!;
        
        devices.push({
          detected: trackedDevice.framesSeen >= this.config.minConsecutiveFrames,
          confidence: deviceConfidence,
          boundingBox: {
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height
          },
          motionScore,
          highlightScore,
          frameCount: trackedDevice.framesSeen
        });
      }
    }
    
    return devices;
  }

  /**
   * Detect skin-colored regions that might contain faces
   */
  private detectSkinRegions(data: Uint8ClampedArray, width: number, height: number): DetectedRegion[] {
    const regions: DetectedRegion[] = [];
    const visited = new Set<number>();
    const minRegionSize = Math.floor(width * height * this.config.minObjectSize);
    const maxRegionSize = Math.floor(width * height * this.config.maxObjectSize);
    
    for (let y = 0; y < height; y += 4) { // Sample every 4th pixel for performance
      for (let x = 0; x < width; x += 4) {
        const idx = (y * width + x) * 4;
        
        if (visited.has(idx) || !this.isSkinColor(data[idx], data[idx + 1], data[idx + 2])) {
          continue;
        }
        
        // Flood fill to find connected skin region
        const region = this.floodFillRegion(data, width, height, x, y, visited, this.isSkinColor.bind(this));
        
        if (region.pixels.length >= minRegionSize && region.pixels.length <= maxRegionSize) {
          regions.push({
            x: region.bounds.minX,
            y: region.bounds.minY,
            width: region.bounds.maxX - region.bounds.minX,
            height: region.bounds.maxY - region.bounds.minY,
            confidence: 0,
            framesSeen: 0,
            lastSeen: 0,
            motionHistory: [],
            highlightHistory: []
          });
        }
      }
    }
    
    return regions;
  }

  /**
   * Detect rectangular regions with high contrast edges
   */
  private detectRectangularRegions(data: Uint8ClampedArray, width: number, height: number): DetectedRegion[] {
    const regions: DetectedRegion[] = [];
    
    // Apply edge detection (simplified Canny-like approach)
    const edges = this.detectEdges(data, width, height);
    
    // Find rectangular contours
    const contours = this.findRectangularContours(edges, width, height);
    
    for (const contour of contours) {
      const aspectRatio = contour.width / contour.height;
      
      // Check if aspect ratio matches phone-like devices
      if (aspectRatio >= this.config.rectangleAspectRatioMin && 
          aspectRatio <= this.config.rectangleAspectRatioMax) {
        
        const regionSize = (contour.width * contour.height) / (width * height);
        
        if (regionSize >= this.config.minObjectSize && regionSize <= this.config.maxObjectSize) {
          regions.push({
            x: contour.x,
            y: contour.y,
            width: contour.width,
            height: contour.height,
            confidence: 0,
            framesSeen: 0,
            lastSeen: 0,
            motionHistory: [],
            highlightHistory: []
          });
        }
      }
    }
    
    return regions;
  }

  /**
   * Check if RGB values represent skin color
   */
  private isSkinColor(r: number, g: number, b: number): boolean {
    // Simple skin color detection in RGB space
    // These ranges work reasonably well for various skin tones
    return (
      r > 95 && g > 40 && b > 20 &&
      Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
      Math.abs(r - g) > 15 && r > g && r > b
    );
  }

  /**
   * Flood fill algorithm to find connected regions
   */
  private floodFillRegion(
    data: Uint8ClampedArray, 
    width: number, 
    height: number, 
    startX: number, 
    startY: number, 
    visited: Set<number>,
    colorTest: (r: number, g: number, b: number) => boolean
  ): { pixels: number[]; bounds: { minX: number; maxX: number; minY: number; maxY: number } } {
    const pixels: number[] = [];
    const stack: [number, number][] = [[startX, startY]];
    const bounds = { minX: startX, maxX: startX, minY: startY, maxY: startY };
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = (y * width + x) * 4;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited.has(idx)) {
        continue;
      }
      
      if (!colorTest(data[idx], data[idx + 1], data[idx + 2])) {
        continue;
      }
      
      visited.add(idx);
      pixels.push(idx);
      
      // Update bounds
      bounds.minX = Math.min(bounds.minX, x);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y);
      
      // Add neighbors to stack
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    return { pixels, bounds };
  }

  /**
   * Simple edge detection using Sobel operator
   */
  private detectEdges(data: Uint8ClampedArray, width: number, height: number): number[] {
    const edges = new Array(width * height).fill(0);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Get grayscale values of surrounding pixels
        const pixels = [
          this.getGrayscale(data, (y - 1) * width + (x - 1)),
          this.getGrayscale(data, (y - 1) * width + x),
          this.getGrayscale(data, (y - 1) * width + (x + 1)),
          this.getGrayscale(data, y * width + (x - 1)),
          this.getGrayscale(data, y * width + (x + 1)),
          this.getGrayscale(data, (y + 1) * width + (x - 1)),
          this.getGrayscale(data, (y + 1) * width + x),
          this.getGrayscale(data, (y + 1) * width + (x + 1))
        ];
        
        // Sobel X and Y gradients
        const gx = (-1 * pixels[0]) + (1 * pixels[2]) + 
                   (-2 * pixels[3]) + (2 * pixels[4]) + 
                   (-1 * pixels[5]) + (1 * pixels[7]);
        
        const gy = (-1 * pixels[0]) + (-2 * pixels[1]) + (-1 * pixels[2]) + 
                   (1 * pixels[5]) + (2 * pixels[6]) + (1 * pixels[7]);
        
        edges[idx] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    
    return edges;
  }

  /**
   * Find rectangular contours from edge data
   */
  private findRectangularContours(edges: number[], width: number, height: number): DetectedRegion[] {
    const contours: DetectedRegion[] = [];
    const threshold = 50; // Edge strength threshold
    
    // Simple rectangular region detection
    for (let y = 10; y < height - 10; y += 5) {
      for (let x = 10; x < width - 10; x += 5) {
        if (edges[y * width + x] > threshold) {
          // Try to find a rectangular region starting from this edge point
          const rect = this.findRectangleFromPoint(edges, width, height, x, y, threshold);
          if (rect) {
            contours.push(rect);
          }
        }
      }
    }
    
    return contours;
  }

  /**
   * Attempt to find a rectangle starting from an edge point
   */
  private findRectangleFromPoint(edges: number[], width: number, height: number, startX: number, startY: number, threshold: number): DetectedRegion | null {
    // Simple rectangle detection - look for strong edges forming a rectangle
    const minSize = 20;
    const maxSize = Math.min(width, height) / 3;
    
    for (let w = minSize; w < maxSize; w += 5) {
      for (let h = minSize; h < maxSize; h += 5) {
        if (startX + w >= width || startY + h >= height) continue;
        
        // Check if edges form a rectangle
        const topEdge = this.checkHorizontalEdge(edges, width, startX, startY, w, threshold);
        const bottomEdge = this.checkHorizontalEdge(edges, width, startX, startY + h, w, threshold);
        const leftEdge = this.checkVerticalEdge(edges, width, startX, startY, h, threshold);
        const rightEdge = this.checkVerticalEdge(edges, width, startX + w, startY, h, threshold);
        
        if (topEdge && bottomEdge && leftEdge && rightEdge) {
          return {
            x: startX,
            y: startY,
            width: w,
            height: h,
            confidence: 0,
            framesSeen: 0,
            lastSeen: 0,
            motionHistory: [],
            highlightHistory: []
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Check for horizontal edge
   */
  private checkHorizontalEdge(edges: number[], width: number, x: number, y: number, length: number, threshold: number): boolean {
    let edgeCount = 0;
    for (let i = 0; i < length; i += 2) {
      if (edges[y * width + (x + i)] > threshold) {
        edgeCount++;
      }
    }
    return edgeCount > length * 0.3; // At least 30% of points should be edges
  }

  /**
   * Check for vertical edge
   */
  private checkVerticalEdge(edges: number[], width: number, x: number, y: number, length: number, threshold: number): boolean {
    let edgeCount = 0;
    for (let i = 0; i < length; i += 2) {
      if (edges[(y + i) * width + x] > threshold) {
        edgeCount++;
      }
    }
    return edgeCount > length * 0.3; // At least 30% of points should be edges
  }

  /**
   * Get grayscale value from RGB data
   */
  private getGrayscale(data: Uint8ClampedArray, pixelIndex: number): number {
    const i = pixelIndex * 4;
    return Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  /**
   * Calculate face confidence based on facial features
   */
  private calculateFaceConfidence(data: Uint8ClampedArray, width: number, height: number, region: DetectedRegion): number {
    let confidence = 0.3; // Base confidence for skin region
    
    // Check for eye-like dark regions in upper third
    const eyeRegionY = region.y + region.height * 0.2;
    const eyeRegionHeight = region.height * 0.3;
    
    const leftEyeX = region.x + region.width * 0.25;
    const rightEyeX = region.x + region.width * 0.75;
    
    if (this.hasDarkRegion(data, width, height, leftEyeX, eyeRegionY, region.width * 0.15, eyeRegionHeight)) {
      confidence += 0.2;
    }
    
    if (this.hasDarkRegion(data, width, height, rightEyeX, eyeRegionY, region.width * 0.15, eyeRegionHeight)) {
      confidence += 0.2;
    }
    
    // Check for mouth-like region in lower third
    const mouthRegionY = region.y + region.height * 0.7;
    const mouthRegionHeight = region.height * 0.2;
    const mouthX = region.x + region.width * 0.4;
    
    if (this.hasDarkRegion(data, width, height, mouthX, mouthRegionY, region.width * 0.2, mouthRegionHeight)) {
      confidence += 0.15;
    }
    
    // Check aspect ratio (faces are typically taller than wide)
    const aspectRatio = region.width / region.height;
    if (aspectRatio >= 0.6 && aspectRatio <= 1.2) {
      confidence += 0.15;
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * Check if region has dark areas (eyes, mouth)
   */
  private hasDarkRegion(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, w: number, h: number): boolean {
    let darkPixels = 0;
    let totalPixels = 0;
    
    const startX = Math.max(0, Math.floor(x));
    const endX = Math.min(width, Math.floor(x + w));
    const startY = Math.max(0, Math.floor(y));
    const endY = Math.min(height, Math.floor(y + h));
    
    for (let py = startY; py < endY; py += 2) {
      for (let px = startX; px < endX; px += 2) {
        const idx = (py * width + px) * 4;
        const gray = this.getGrayscale(data, py * width + px);
        
        if (gray < 80) { // Dark threshold
          darkPixels++;
        }
        totalPixels++;
      }
    }
    
    return totalPixels > 0 && (darkPixels / totalPixels) > 0.3;
  }

  /**
   * Calculate motion score for a region
   */
  private calculateMotionScore(currentFrame: ImageData, region: DetectedRegion): number {
    if (!this.previousFrame) {
      return 0;
    }
    
    const { data: currentData } = currentFrame;
    const { data: previousData } = this.previousFrame;
    
    let totalDiff = 0;
    let pixelCount = 0;
    
    const startX = Math.max(0, Math.floor(region.x));
    const endX = Math.min(currentFrame.width, Math.floor(region.x + region.width));
    const startY = Math.max(0, Math.floor(region.y));
    const endY = Math.min(currentFrame.height, Math.floor(region.y + region.height));
    
    for (let y = startY; y < endY; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const idx = (y * currentFrame.width + x) * 4;
        
        const currentGray = this.getGrayscale(currentData, y * currentFrame.width + x);
        const previousGray = this.getGrayscale(previousData, y * currentFrame.width + x);
        
        totalDiff += Math.abs(currentGray - previousGray);
        pixelCount++;
      }
    }
    
    return pixelCount > 0 ? (totalDiff / pixelCount) / 255 : 0;
  }

  /**
   * Calculate highlight score (specular reflections)
   */
  private calculateHighlightScore(data: Uint8ClampedArray, width: number, height: number, region: DetectedRegion): number {
    let brightPixels = 0;
    let totalPixels = 0;
    
    const startX = Math.max(0, Math.floor(region.x));
    const endX = Math.min(width, Math.floor(region.x + region.width));
    const startY = Math.max(0, Math.floor(region.y));
    const endY = Math.min(height, Math.floor(region.y + region.height));
    
    for (let y = startY; y < endY; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const idx = (y * width + x) * 4;
        const gray = this.getGrayscale(data, y * width + x);
        
        if (gray > 200) { // Bright threshold for highlights
          brightPixels++;
        }
        totalPixels++;
      }
    }
    
    return totalPixels > 0 ? brightPixels / totalPixels : 0;
  }

  /**
   * Calculate device confidence based on multiple factors
   */
  private calculateDeviceConfidence(region: DetectedRegion, motionScore: number, highlightScore: number): number {
    let confidence = 0.2; // Base confidence for rectangular shape
    
    // Aspect ratio bonus (phone-like)
    const aspectRatio = region.width / region.height;
    if (aspectRatio >= 0.5 && aspectRatio <= 0.7) {
      confidence += 0.3;
    }
    
    // Motion bonus (devices are often moved)
    if (motionScore > this.config.motionThreshold) {
      confidence += 0.2;
    }
    
    // Highlight bonus (screen reflections)
    if (highlightScore > this.config.highlightThreshold) {
      confidence += 0.3;
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * Check if two regions overlap
   */
  private regionsOverlap(region1: DetectedRegion, region2: { x: number; y: number; width: number; height: number }, threshold: number): boolean {
    const overlap = Math.max(0, Math.min(region1.x + region1.width, region2.x + region2.width) - Math.max(region1.x, region2.x)) *
                   Math.max(0, Math.min(region1.y + region1.height, region2.y + region2.height) - Math.max(region1.y, region2.y));
    
    const area1 = region1.width * region1.height;
    const area2 = region2.width * region2.height;
    const minArea = Math.min(area1, area2);
    
    return (overlap / minArea) > threshold;
  }

  /**
   * Clean up old detections that haven't been seen recently
   */
  private cleanupOldDetections(): void {
    const maxAge = 30; // frames
    
    for (const [id, detection] of this.detectedFaces.entries()) {
      if (this.frameCounter - detection.lastSeen > maxAge) {
        this.detectedFaces.delete(id);
      }
    }
    
    for (const [id, detection] of this.detectedDevices.entries()) {
      if (this.frameCounter - detection.lastSeen > maxAge) {
        this.detectedDevices.delete(id);
      }
    }
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.previousFrame = null;
    this.detectedFaces.clear();
    this.detectedDevices.clear();
    this.frameCounter = 0;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.reset();
    // Canvas will be garbage collected
  }
}