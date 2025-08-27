/**
 * Real MediaPipe Face Detection - NO MOCK DATA
 */

let FaceMesh = null;
let Camera = null;
let drawingUtils = null;

// Initialize MediaPipe
const initMediaPipe = async () => {
  if (typeof window === 'undefined') return false;
  
  try {
    const faceMeshModule = await import('@mediapipe/face_mesh');
    const cameraModule = await import('@mediapipe/camera_utils');
    const drawingModule = await import('@mediapipe/drawing_utils');
    
    FaceMesh = faceMeshModule.FaceMesh;
    Camera = cameraModule.Camera;
    drawingUtils = drawingModule;
    
    return true;
  } catch (error) {
    console.error('Failed to load MediaPipe:', error);
    return false;
  }
};

export class RealFaceDetector {
  constructor() {
    this.faceMesh = null;
    this.camera = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.isInitialized = false;
    this.currentFaceData = null;
    this.faceHistory = [];
    this.onFaceDetected = null;
  }

  async initialize(videoElement, canvasElement) {
    const success = await initMediaPipe();
    if (!success) return false;

    this.videoElement = videoElement;
    this.canvasElement = canvasElement;

    // Initialize MediaPipe FaceMesh
    this.faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.faceMesh.onResults(this.onResults.bind(this));

    // Initialize camera
    this.camera = new Camera(videoElement, {
      onFrame: async () => {
        await this.faceMesh.send({ image: videoElement });
      },
      width: 640,
      height: 480
    });

    this.isInitialized = true;
    return true;
  }  async start() {
    if (!this.isInitialized || !this.camera) return false;
    
    try {
      await this.camera.start();
      console.log('Real face detection started');
      return true;
    } catch (error) {
      console.error('Failed to start face detection:', error);
      return false;
    }
  }

  stop() {
    if (this.camera) {
      this.camera.stop();
    }
    this.currentFaceData = null;
    this.faceHistory = [];
  }

  onResults(results) {
    const ctx = this.canvasElement.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    
    // Draw the video frame
    ctx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      
      // Calculate real face data
      const faceData = this.calculateRealFaceData(landmarks);
      this.currentFaceData = faceData;
      
      // Add to history for stability calculation
      this.faceHistory.push({
        ...faceData,
        timestamp: Date.now()
      });
      
      // Keep only last 30 samples (3 seconds at 10fps)
      if (this.faceHistory.length > 30) {
        this.faceHistory.shift();
      }
      
      // Draw face landmarks
      this.drawFaceLandmarks(ctx, landmarks);
      
      // Callback for real-time updates
      if (this.onFaceDetected) {
        this.onFaceDetected(faceData);
      }
    } else {
      // No face detected
      this.currentFaceData = {
        detected: false,
        confidence: 0,
        boundingBox: null,
        landmarks: null,
        stability: 0,
        timestamp: Date.now()
      };
      
      if (this.onFaceDetected) {
        this.onFaceDetected(this.currentFaceData);
      }
    }
    
    ctx.restore();
  }

  calculateRealFaceData(landmarks) {
    // Calculate bounding box from landmarks
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    
    landmarks.forEach(landmark => {
      minX = Math.min(minX, landmark.x);
      maxX = Math.max(maxX, landmark.x);
      minY = Math.min(minY, landmark.y);
      maxY = Math.max(maxY, landmark.y);
    });
    
    const boundingBox = {
      x: minX * this.canvasElement.width,
      y: minY * this.canvasElement.height,
      width: (maxX - minX) * this.canvasElement.width,
      height: (maxY - minY) * this.canvasElement.height,
      centerX: ((minX + maxX) / 2) * this.canvasElement.width,
      centerY: ((minY + maxY) / 2) * this.canvasElement.height
    };
    
    // Calculate confidence based on landmark quality
    const confidence = this.calculateLandmarkConfidence(landmarks);
    
    // Calculate stability from recent history
    const stability = this.calculateFaceStability();
    
    return {
      detected: true,
      confidence,
      boundingBox,
      landmarks: landmarks,
      stability,
      timestamp: Date.now()
    };
  }

  calculateLandmarkConfidence(landmarks) {
    // Check landmark quality - all landmarks should be within frame
    let validLandmarks = 0;
    
    landmarks.forEach(landmark => {
      if (landmark.x >= 0 && landmark.x <= 1 && 
          landmark.y >= 0 && landmark.y <= 1 &&
          landmark.z !== undefined) {
        validLandmarks++;
      }
    });
    
    return validLandmarks / landmarks.length;
  }

  calculateFaceStability() {
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
    const maxAcceptableMovement = 20; // pixels
    
    return Math.max(0, 1 - (averageMovement / maxAcceptableMovement));
  }

  drawFaceLandmarks(ctx, landmarks) {
    // Draw face outline
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Face contour landmarks (simplified)
    const faceOval = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
    
    faceOval.forEach((index, i) => {
      if (landmarks[index]) {
        const x = landmarks[index].x * ctx.canvas.width;
        const y = landmarks[index].y * ctx.canvas.height;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    
    ctx.closePath();
    ctx.stroke();
    
    // Draw eyes
    ctx.fillStyle = '#ff0000';
    const leftEye = landmarks[33]; // Left eye center
    const rightEye = landmarks[362]; // Right eye center
    
    if (leftEye) {
      ctx.beginPath();
      ctx.arc(leftEye.x * ctx.canvas.width, leftEye.y * ctx.canvas.height, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    if (rightEye) {
      ctx.beginPath();
      ctx.arc(rightEye.x * ctx.canvas.width, rightEye.y * ctx.canvas.height, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  getCurrentFaceData() {
    return this.currentFaceData;
  }

  getFaceHistory() {
    return this.faceHistory;
  }

  isReady() {
    return this.isInitialized && this.camera;
  }
}

// Export singleton instance
export const realFaceDetector = new RealFaceDetector();