/**
 * Simple Real Face Detection using getUserMedia and basic computer vision
 * No external CDN dependencies - works offline
 */

class SimpleFaceDetector {
  constructor() {
    this.videoElement = null;
    this.canvasElement = null;
    this.isInitialized = false;
    this.isRunning = false;
    this.currentFaceData = null;
    this.faceHistory = [];
    this.onFaceDetected = null;
    this.animationFrame = null;
  }

  async initialize(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    
    // Set canvas size to match video
    this.canvasElement.width = 640;
    this.canvasElement.height = 480;
    
    this.isInitialized = true;
    console.log('Simple face detector initialized');
    return true;
  }

  async start() {
    if (!this.isInitialized) return false;
    
    this.isRunning = true;
    this.processFrame();
    console.log('Simple face detection started');
    return true;
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.currentFaceData = null;
    this.faceHistory = [];
  }

  processFrame() {
    if (!this.isRunning || !this.videoElement || !this.canvasElement) return;

    const ctx = this.canvasElement.getContext('2d');
    
    // Draw video frame to canvas
    ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
    
    // Perform simple face detection using pixel analysis
    const faceData = this.detectFaceFromPixels(ctx);
    
    // Update current face data
    this.currentFaceData = faceData;
    
    // Add to history
    this.faceHistory.push({
      ...faceData,
      timestamp: Date.now()
    });
    
    // Keep only last 30 samples (3 seconds at 10fps)
    if (this.faceHistory.length > 30) {
      this.faceHistory.shift();
    }
    
    // Draw face detection overlay
    if (faceData.detected) {
      this.drawFaceOverlay(ctx, faceData.boundingBox);
    }
    
    // Callback for real-time updates
    if (this.onFaceDetected) {
      this.onFaceDetected(faceData);
    }
    
    // Continue processing
    this.animationFrame = requestAnimationFrame(() => this.processFrame());
  }

  detectFaceFromPixels(ctx) {
    const imageData = ctx.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
    const data = imageData.data;
    
    // Simple skin tone detection for face region
    const skinPixels = [];
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;
    
    for (let y = 0; y < height; y += 4) { // Sample every 4th row for performance
      for (let x = 0; x < width; x += 4) { // Sample every 4th column
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Simple skin tone detection
        if (this.isSkinTone(r, g, b)) {
          skinPixels.push({ x, y });
        }
      }
    }
    
    if (skinPixels.length < 50) { // Minimum skin pixels for face detection
      return {
        detected: false,
        confidence: 0,
        boundingBox: null,
        stability: 0,
        timestamp: Date.now()
      };
    }
    
    // Calculate bounding box from skin pixels
    const boundingBox = this.calculateBoundingBox(skinPixels);
    
    // Calculate confidence based on skin pixel density and shape
    const confidence = this.calculateConfidence(skinPixels, boundingBox);
    
    // Calculate stability from recent history
    const stability = this.calculateStability();
    
    return {
      detected: true,
      confidence,
      boundingBox,
      stability,
      timestamp: Date.now()
    };
  }

  isSkinTone(r, g, b) {
    // Simple skin tone detection algorithm
    // Based on RGB values typical for human skin
    return (
      r > 95 && g > 40 && b > 20 &&
      r > g && r > b &&
      Math.abs(r - g) > 15 &&
      r - b > 15 &&
      r < 250 && g < 200 && b < 150
    );
  }

  calculateBoundingBox(skinPixels) {
    if (skinPixels.length === 0) return null;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    skinPixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }

  calculateConfidence(skinPixels, boundingBox) {
    if (!boundingBox) return 0;
    
    // Calculate confidence based on:
    // 1. Skin pixel density in bounding box
    // 2. Aspect ratio (faces are roughly oval)
    // 3. Size (not too small or too large)
    
    const boxArea = boundingBox.width * boundingBox.height;
    const skinDensity = skinPixels.length / (boxArea / 16); // Adjust for sampling
    
    const aspectRatio = boundingBox.width / boundingBox.height;
    const idealAspectRatio = 0.75; // Faces are typically 3:4 ratio
    const aspectScore = 1 - Math.abs(aspectRatio - idealAspectRatio);
    
    const canvasArea = this.canvasElement.width * this.canvasElement.height;
    const sizeRatio = boxArea / canvasArea;
    const sizeScore = sizeRatio > 0.05 && sizeRatio < 0.5 ? 1 : 0.5;
    
    return Math.min(skinDensity * 0.4 + aspectScore * 0.3 + sizeScore * 0.3, 1);
  }

  calculateStability() {
    if (this.faceHistory.length < 2) return 0;
    
    let totalMovement = 0;
    let validComparisons = 0;
    
    for (let i = 1; i < this.faceHistory.length; i++) {
      const prev = this.faceHistory[i - 1];
      const curr = this.faceHistory[i];
      
      if (prev.detected && curr.detected && prev.boundingBox && curr.boundingBox) {
        const movement = Math.sqrt(
          Math.pow(curr.boundingBox.centerX - prev.boundingBox.centerX, 2) +
          Math.pow(curr.boundingBox.centerY - prev.boundingBox.centerY, 2)
        );
        totalMovement += movement;
        validComparisons++;
      }
    }
    
    if (validComparisons === 0) return 0;
    
    const averageMovement = totalMovement / validComparisons;
    const maxAcceptableMovement = 30; // pixels
    
    return Math.max(0, 1 - (averageMovement / maxAcceptableMovement));
  }

  drawFaceOverlay(ctx, boundingBox) {
    if (!boundingBox) return;
    
    // Draw face bounding box
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
    
    // Draw center point
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(boundingBox.centerX, boundingBox.centerY, 5, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw confidence text
    ctx.fillStyle = '#00ff00';
    ctx.font = '16px Arial';
    ctx.fillText(
      `Face: ${Math.round(this.currentFaceData.confidence * 100)}%`,
      boundingBox.x,
      boundingBox.y - 10
    );
  }

  getCurrentFaceData() {
    return this.currentFaceData;
  }

  getFaceHistory() {
    return this.faceHistory;
  }

  isReady() {
    return this.isInitialized;
  }
}

// Export singleton instance
export const simpleFaceDetector = new SimpleFaceDetector();