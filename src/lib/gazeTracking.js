/**
 * WebGazer.js integration for real gaze tracking
 */

let webgazer = null;
let isInitialized = false;
let isCalibrating = false;

// Dynamically import WebGazer to avoid SSR issues
const initWebGazer = async () => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Import WebGazer dynamically
    const WebGazer = await import('webgazer');
    webgazer = WebGazer.default;
    
    // Configure WebGazer
    webgazer.params.showVideo = true;
    webgazer.params.showFaceOverlay = false;
    webgazer.params.showFaceFeedbackBox = false;
    webgazer.params.showGazeDot = false;
    
    console.log('WebGazer initialized');
    return webgazer;
  } catch (error) {
    console.error('Failed to initialize WebGazer:', error);
    return null;
  }
};

export const gazeTracker = {
  async start() {
    if (isInitialized) return true;
    
    try {
      await initWebGazer();
      if (!webgazer) return false;
      
      // Start WebGazer with face detection
      await webgazer.setRegression('ridge')
        .setTracker('clmtrackr')
        .setGazeListener((data, elapsedTime) => {
          // Store latest gaze data for face detection validation
          if (data) {
            window.lastGazeData = {
              x: data.x,
              y: data.y,
              timestamp: Date.now(),
              elapsedTime
            };
          }
        })
        .begin();
      
      // Wait for camera to be ready
      await new Promise((resolve) => {
        const checkReady = () => {
          if (webgazer.isReady()) {
            // Move video to our container
            const video = document.getElementById('webgazerVideoFeed');
            const container = document.getElementById('webgazerVideoContainer');
            if (video && container) {
              video.style.width = '100%';
              video.style.height = '100%';
              video.style.objectFit = 'cover';
              container.appendChild(video);
            }
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
      
      isInitialized = true;
      console.log('Gaze tracking started with face detection');
      return true;
    } catch (error) {
      console.error('Failed to start gaze tracking:', error);
      return false;
    }
  },

  async stop() {
    if (webgazer && isInitialized) {
      webgazer.end();
      isInitialized = false;
      console.log('Gaze tracking stopped');
    }
  },

  getCurrentGaze() {
    if (!webgazer || !isInitialized) return null;
    
    return new Promise((resolve) => {
      webgazer.getCurrentPrediction().then((prediction) => {
        if (prediction) {
          resolve({
            x: prediction.x,
            y: prediction.y,
            timestamp: Date.now()
          });
        } else {
          resolve(null);
        }
      });
    });
  },

  async startCalibration() {
    if (!webgazer || !isInitialized) return false;
    
    isCalibrating = true;
    // Clear any existing calibration data
    webgazer.clearData();
    console.log('Calibration started');
    return true;
  },

  async addCalibrationPoint(x, y, duration = 1000) {
    if (!webgazer || !isInitialized || !isCalibrating) return false;
    
    return new Promise((resolve) => {
      console.log(`Adding calibration point at (${x}, ${y})`);
      
      // Collect multiple samples for this point
      const samples = [];
      const sampleInterval = 100; // Sample every 100ms
      const totalSamples = duration / sampleInterval;
      
      let sampleCount = 0;
      const interval = setInterval(() => {
        // Add calibration data point
        webgazer.recordScreenPosition(x, y);
        sampleCount++;
        
        if (sampleCount >= totalSamples) {
          clearInterval(interval);
          console.log(`Collected ${sampleCount} samples for point (${x}, ${y})`);
          resolve(true);
        }
      }, sampleInterval);
    });
  },

  async finishCalibration() {
    if (!webgazer || !isInitialized) return null;
    
    isCalibrating = false;
    
    // Get calibration quality
    const quality = await this.getCalibrationQuality();
    
    console.log('Calibration finished with quality:', quality);
    return {
      quality,
      timestamp: Date.now()
    };
  },

  async getCalibrationQuality() {
    if (!webgazer || !isInitialized) return 0;
    
    // Test calibration accuracy with a few sample points
    const testPoints = [
      { x: window.innerWidth * 0.2, y: window.innerHeight * 0.2 },
      { x: window.innerWidth * 0.8, y: window.innerHeight * 0.2 },
      { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 },
      { x: window.innerWidth * 0.2, y: window.innerHeight * 0.8 },
      { x: window.innerWidth * 0.8, y: window.innerHeight * 0.8 }
    ];
    
    let totalError = 0;
    let validPredictions = 0;
    
    for (const point of testPoints) {
      const prediction = await this.getCurrentGaze();
      if (prediction) {
        const error = Math.sqrt(
          Math.pow(prediction.x - point.x, 2) + 
          Math.pow(prediction.y - point.y, 2)
        );
        totalError += error;
        validPredictions++;
      }
    }
    
    if (validPredictions === 0) return 0;
    
    const averageError = totalError / validPredictions;
    const maxError = Math.sqrt(Math.pow(window.innerWidth, 2) + Math.pow(window.innerHeight, 2));
    
    // Convert error to quality score (0-1, where 1 is perfect)
    return Math.max(0, 1 - (averageError / (maxError * 0.1)));
  },

  isReady() {
    return webgazer && isInitialized && webgazer.isReady();
  },

  getVideoElement() {
    if (!webgazer || !isInitialized) return null;
    return document.getElementById('webgazerVideoFeed');
  },

  // Face detection methods
  isFaceDetected() {
    if (!webgazer || !isInitialized) return false;
    
    try {
      // Check if WebGazer's face tracker has detected a face
      const tracker = webgazer.getTracker();
      if (tracker && tracker.getCurrentPosition) {
        const position = tracker.getCurrentPosition();
        return position && position.length > 0;
      }
      
      // Fallback: check if we're getting gaze predictions
      const lastGaze = window.lastGazeData;
      if (lastGaze && Date.now() - lastGaze.timestamp < 1000) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Face detection check failed:', error);
      return false;
    }
  },

  getFaceData() {
    if (!webgazer || !isInitialized) return null;
    
    try {
      const tracker = webgazer.getTracker();
      if (tracker && tracker.getCurrentPosition) {
        const position = tracker.getCurrentPosition();
        if (position && position.length > 0) {
          // Extract face landmarks and calculate face metrics
          const landmarks = position;
          const faceBox = this.calculateFaceBoundingBox(landmarks);
          
          return {
            detected: true,
            landmarks: landmarks,
            boundingBox: faceBox,
            confidence: this.calculateFaceConfidence(landmarks),
            timestamp: Date.now()
          };
        }
      }
      
      return {
        detected: false,
        landmarks: null,
        boundingBox: null,
        confidence: 0,
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn('Failed to get face data:', error);
      return null;
    }
  },

  calculateFaceBoundingBox(landmarks) {
    if (!landmarks || landmarks.length === 0) return null;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    // Find bounding box from landmarks
    for (let i = 0; i < landmarks.length; i += 2) {
      const x = landmarks[i];
      const y = landmarks[i + 1];
      
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  },

  calculateFaceConfidence(landmarks) {
    if (!landmarks || landmarks.length === 0) return 0;
    
    // Calculate confidence based on landmark stability and completeness
    const expectedLandmarks = 70; // CLM tracker typically provides ~70 landmarks
    const actualLandmarks = landmarks.length / 2;
    
    const completeness = Math.min(actualLandmarks / expectedLandmarks, 1);
    
    // Check for landmark stability (not all zeros or extreme values)
    let validLandmarks = 0;
    for (let i = 0; i < landmarks.length; i += 2) {
      const x = landmarks[i];
      const y = landmarks[i + 1];
      
      if (x > 0 && y > 0 && x < 1000 && y < 1000) {
        validLandmarks++;
      }
    }
    
    const stability = validLandmarks / (landmarks.length / 2);
    
    return (completeness * 0.6 + stability * 0.4);
  },

  // Real-time face validation for calibration
  async validateFaceForCalibration(duration = 3000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const samples = [];
      
      const checkInterval = setInterval(() => {
        const faceData = this.getFaceData();
        const elapsed = Date.now() - startTime;
        
        if (faceData) {
          samples.push(faceData);
        }
        
        if (elapsed >= duration) {
          clearInterval(checkInterval);
          
          // Analyze face detection quality over the duration
          const validSamples = samples.filter(s => s.detected && s.confidence > 0.5);
          const detectionRate = validSamples.length / samples.length;
          
          const result = {
            success: detectionRate > 0.8, // 80% detection rate required
            detectionRate,
            averageConfidence: validSamples.length > 0 
              ? validSamples.reduce((sum, s) => sum + s.confidence, 0) / validSamples.length 
              : 0,
            totalSamples: samples.length,
            validSamples: validSamples.length,
            faceStability: this.calculateFaceStability(validSamples)
          };
          
          resolve(result);
        }
      }, 100); // Check every 100ms
    });
  },

  calculateFaceStability(samples) {
    if (samples.length < 2) return 0;
    
    let totalMovement = 0;
    
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const curr = samples[i];
      
      if (prev.boundingBox && curr.boundingBox) {
        const movement = Math.sqrt(
          Math.pow(curr.boundingBox.centerX - prev.boundingBox.centerX, 2) +
          Math.pow(curr.boundingBox.centerY - prev.boundingBox.centerY, 2)
        );
        totalMovement += movement;
      }
    }
    
    const averageMovement = totalMovement / (samples.length - 1);
    
    // Convert movement to stability score (lower movement = higher stability)
    const maxAcceptableMovement = 50; // pixels
    return Math.max(0, 1 - (averageMovement / maxAcceptableMovement));
  }
};