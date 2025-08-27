/**
 * Professional-grade WebGazer.js integration for real gaze tracking
 * Designed to match the quality of platforms like HackerRank
 */

let webgazer = null;
let isInitialized = false;
let isCalibrating = false;
let gazeHistory = [];
let calibrationData = [];
let realTimeGazeCallback = null;
let performanceMonitor = null;

// Performance monitoring
const initPerformanceMonitor = () => {
  return {
    frameCount: 0,
    lastFrameTime: Date.now(),
    fps: 0,
    avgAccuracy: 0,
    droppedFrames: 0,
    
    update() {
      this.frameCount++;
      const now = Date.now();
      if (now - this.lastFrameTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastFrameTime = now;
      }
    },
    
    getMetrics() {
      return {
        fps: this.fps,
        avgAccuracy: this.avgAccuracy,
        droppedFrames: this.droppedFrames,
        gazeHistorySize: gazeHistory.length
      };
    }
  };
};

// Dynamically import WebGazer to avoid SSR issues
const initWebGazer = async () => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Import WebGazer dynamically
    const WebGazer = await import('webgazer');
    webgazer = WebGazer.default;
    
    // Professional configuration for exam platforms
    webgazer.params.showVideo = false; // We'll handle video display ourselves
    webgazer.params.showFaceOverlay = false;
    webgazer.params.showFaceFeedbackBox = false;
    webgazer.params.showGazeDot = false;
    webgazer.params.showPredictionPoints = false;
    
    // Performance optimizations
    webgazer.params.videoElementWebRTC = null;
    webgazer.params.videoElementCanvas = null;
    
    console.log('WebGazer initialized with professional configuration');
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
      
      // Initialize performance monitor
      performanceMonitor = initPerformanceMonitor();
      
      // Professional-grade WebGazer setup
      await webgazer
        .setRegression('ridge') // Most accurate regression model
        .setTracker('clmtrackr') // Best face tracker for precision
        .setGazeListener((data, elapsedTime) => {
          if (data && data.x !== undefined && data.y !== undefined) {
            performanceMonitor.update();
            
            const gazePoint = {
              x: data.x,
              y: data.y,
              timestamp: Date.now(),
              elapsedTime,
              confidence: this.calculateGazeConfidence(data),
              screenBounds: {
                width: window.innerWidth,
                height: window.innerHeight
              }
            };
            
            // Add to history for stability analysis
            gazeHistory.push(gazePoint);
            
            // Keep only last 100 samples (about 3-4 seconds at 30fps)
            if (gazeHistory.length > 100) {
              gazeHistory.shift();
            }
            
            // Store for global access
            window.lastGazeData = gazePoint;
            
            // Real-time callback for monitoring
            if (realTimeGazeCallback) {
              realTimeGazeCallback(gazePoint);
            }
          }
        })
        .begin();
      
      // Enhanced camera readiness check
      await new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        
        const checkReady = () => {
          attempts++;
          
          if (webgazer.isReady()) {
            // Setup video element properly
            this.setupVideoElement();
            resolve();
          } else if (attempts >= maxAttempts) {
            reject(new Error('WebGazer failed to initialize within timeout'));
          } else {
            setTimeout(checkReady, 100);
          }
        };
        
        checkReady();
      });
      
      // Warm up the system with some initial predictions
      await this.warmupSystem();
      
      isInitialized = true;
      console.log('Professional gaze tracking system started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start gaze tracking:', error);
      return false;
    }
  },

  setupVideoElement() {
    const video = document.getElementById('webgazerVideoFeed');
    const container = document.getElementById('webgazerVideoContainer');
    
    if (video && container) {
      // Professional video setup
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.borderRadius = '8px';
      video.style.backgroundColor = '#000';
      
      // Ensure proper video quality
      video.setAttribute('playsinline', 'true');
      video.setAttribute('muted', 'true');
      
      container.appendChild(video);
      
      // Add video quality indicator
      const qualityIndicator = document.createElement('div');
      qualityIndicator.id = 'gazeQualityIndicator';
      qualityIndicator.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-family: monospace;
        z-index: 10;
      `;
      container.appendChild(qualityIndicator);
      
      // Update quality indicator
      setInterval(() => {
        if (performanceMonitor) {
          const metrics = performanceMonitor.getMetrics();
          qualityIndicator.textContent = `${metrics.fps}fps`;
          qualityIndicator.style.color = metrics.fps >= 25 ? '#10b981' : metrics.fps >= 15 ? '#f59e0b' : '#ef4444';
        }
      }, 1000);
    }
  },

  async warmupSystem() {
    // Collect some initial gaze predictions to stabilize the system
    console.log('Warming up gaze tracking system...');
    
    for (let i = 0; i < 10; i++) {
      try {
        await this.getCurrentGaze();
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Ignore warmup errors
      }
    }
    
    console.log('Gaze tracking system warmed up');
  },

  async stop() {
    if (webgazer && isInitialized) {
      // Clean shutdown
      realTimeGazeCallback = null;
      gazeHistory = [];
      calibrationData = [];
      performanceMonitor = null;
      
      webgazer.end();
      isInitialized = false;
      console.log('Professional gaze tracking system stopped');
    }
  },

  getCurrentGaze() {
    if (!webgazer || !isInitialized) return Promise.resolve(null);
    
    return new Promise((resolve) => {
      try {
        webgazer.getCurrentPrediction().then((prediction) => {
          if (prediction && prediction.x !== undefined && prediction.y !== undefined) {
            const gazePoint = {
              x: prediction.x,
              y: prediction.y,
              timestamp: Date.now(),
              confidence: this.calculateGazeConfidence(prediction),
              isValid: this.validateGazePoint(prediction)
            };
            resolve(gazePoint);
          } else {
            resolve(null);
          }
        }).catch(() => {
          resolve(null);
        });
      } catch (error) {
        resolve(null);
      }
    });
  },

  calculateGazeConfidence(gazeData) {
    if (!gazeData || gazeData.x === undefined || gazeData.y === undefined) return 0;
    
    // Check if gaze point is within screen bounds
    const inBounds = gazeData.x >= 0 && gazeData.x <= window.innerWidth &&
                     gazeData.y >= 0 && gazeData.y <= window.innerHeight;
    
    if (!inBounds) return 0.1;
    
    // Calculate confidence based on recent gaze stability
    if (gazeHistory.length < 3) return 0.5;
    
    const recentGazes = gazeHistory.slice(-5);
    let totalVariance = 0;
    
    for (let i = 1; i < recentGazes.length; i++) {
      const distance = Math.sqrt(
        Math.pow(recentGazes[i].x - recentGazes[i-1].x, 2) +
        Math.pow(recentGazes[i].y - recentGazes[i-1].y, 2)
      );
      totalVariance += distance;
    }
    
    const avgVariance = totalVariance / (recentGazes.length - 1);
    const maxAcceptableVariance = 50; // pixels
    
    const stabilityScore = Math.max(0, 1 - (avgVariance / maxAcceptableVariance));
    return Math.min(0.9, 0.3 + stabilityScore * 0.6);
  },

  validateGazePoint(gazeData) {
    if (!gazeData) return false;
    
    // Basic validation
    if (gazeData.x === undefined || gazeData.y === undefined) return false;
    if (isNaN(gazeData.x) || isNaN(gazeData.y)) return false;
    
    // Screen bounds check
    if (gazeData.x < -100 || gazeData.x > window.innerWidth + 100) return false;
    if (gazeData.y < -100 || gazeData.y > window.innerHeight + 100) return false;
    
    return true;
  },

  async startCalibration() {
    if (!webgazer || !isInitialized) return false;
    
    isCalibrating = true;
    calibrationData = [];
    
    // Clear any existing calibration data
    webgazer.clearData();
    
    // Reset gaze history for fresh calibration
    gazeHistory = [];
    
    console.log('Professional calibration started');
    return true;
  },

  async addCalibrationPoint(x, y, duration = 3000) {
    if (!webgazer || !isInitialized || !isCalibrating) return false;
    
    return new Promise((resolve) => {
      console.log(`Collecting calibration data for point (${x}, ${y})`);
      
      const startTime = Date.now();
      const samples = [];
      const sampleInterval = 50; // Sample every 50ms for higher precision
      const minSamples = 30; // Minimum samples required
      const maxSamples = duration / sampleInterval;
      
      let sampleCount = 0;
      let validSamples = 0;
      
      const collectSample = () => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= duration || sampleCount >= maxSamples) {
          // Calibration point complete
          const pointData = {
            screenPoint: { x, y },
            samples: samples,
            validSamples: validSamples,
            totalSamples: sampleCount,
            quality: validSamples / sampleCount,
            timestamp: Date.now()
          };
          
          calibrationData.push(pointData);
          
          console.log(`Calibration point (${x}, ${y}) completed: ${validSamples}/${sampleCount} valid samples`);
          resolve(validSamples >= minSamples);
          return;
        }
        
        // Record calibration point in WebGazer
        webgazer.recordScreenPosition(x, y);
        
        // Also collect our own sample for quality analysis
        this.getCurrentGaze().then(gazePoint => {
          sampleCount++;
          
          if (gazePoint && gazePoint.isValid) {
            samples.push({
              gaze: gazePoint,
              screen: { x, y },
              timestamp: Date.now(),
              error: Math.sqrt(
                Math.pow(gazePoint.x - x, 2) + 
                Math.pow(gazePoint.y - y, 2)
              )
            });
            validSamples++;
          }
          
          setTimeout(collectSample, sampleInterval);
        });
      };
      
      // Start collecting after a brief delay
      setTimeout(collectSample, 200);
    });
  },

  async finishCalibration() {
    if (!webgazer || !isInitialized) return null;
    
    isCalibrating = false;
    
    // Calculate comprehensive calibration quality
    const quality = await this.calculateCalibrationQuality();
    const accuracy = await this.testCalibrationAccuracy();
    
    const result = {
      quality: quality,
      accuracy: accuracy,
      calibrationData: calibrationData,
      totalPoints: calibrationData.length,
      averageError: this.calculateAverageError(),
      timestamp: Date.now(),
      isValid: quality > 0.6 && accuracy > 0.7
    };
    
    console.log('Professional calibration completed:', result);
    return result;
  },

  async calculateCalibrationQuality() {
    if (calibrationData.length === 0) return 0;
    
    // Calculate quality based on collected calibration data
    let totalQuality = 0;
    let validPoints = 0;
    
    for (const pointData of calibrationData) {
      if (pointData.validSamples > 0) {
        // Calculate average error for this point
        const avgError = pointData.samples.reduce((sum, sample) => sum + sample.error, 0) / pointData.samples.length;
        
        // Convert error to quality (lower error = higher quality)
        const maxAcceptableError = 100; // pixels
        const pointQuality = Math.max(0, 1 - (avgError / maxAcceptableError));
        
        totalQuality += pointQuality * pointData.quality; // Weight by sample quality
        validPoints++;
      }
    }
    
    return validPoints > 0 ? totalQuality / validPoints : 0;
  },

  async testCalibrationAccuracy() {
    if (!webgazer || !isInitialized) return 0;
    
    // Test accuracy with validation points
    const testPoints = [
      { x: window.innerWidth * 0.25, y: window.innerHeight * 0.25 },
      { x: window.innerWidth * 0.75, y: window.innerHeight * 0.25 },
      { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 },
      { x: window.innerWidth * 0.25, y: window.innerHeight * 0.75 },
      { x: window.innerWidth * 0.75, y: window.innerHeight * 0.75 }
    ];
    
    let totalError = 0;
    let validTests = 0;
    
    // Test each point multiple times for reliability
    for (const testPoint of testPoints) {
      const errors = [];
      
      for (let i = 0; i < 3; i++) {
        const prediction = await this.getCurrentGaze();
        if (prediction && prediction.isValid) {
          const error = Math.sqrt(
            Math.pow(prediction.x - testPoint.x, 2) + 
            Math.pow(prediction.y - testPoint.y, 2)
          );
          errors.push(error);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (errors.length > 0) {
        const avgError = errors.reduce((sum, err) => sum + err, 0) / errors.length;
        totalError += avgError;
        validTests++;
      }
    }
    
    if (validTests === 0) return 0;
    
    const averageError = totalError / validTests;
    const maxAcceptableError = 150; // pixels - professional standard
    
    // Convert to accuracy score (0-1)
    return Math.max(0, 1 - (averageError / maxAcceptableError));
  },

  calculateAverageError() {
    if (calibrationData.length === 0) return Infinity;
    
    let totalError = 0;
    let totalSamples = 0;
    
    for (const pointData of calibrationData) {
      for (const sample of pointData.samples) {
        totalError += sample.error;
        totalSamples++;
      }
    }
    
    return totalSamples > 0 ? totalError / totalSamples : Infinity;
  },

  isReady() {
    return webgazer && isInitialized && webgazer.isReady();
  },

  getVideoElement() {
    if (!webgazer || !isInitialized) return null;
    return document.getElementById('webgazerVideoFeed');
  },

  // Professional monitoring features
  setRealTimeGazeCallback(callback) {
    realTimeGazeCallback = callback;
  },

  removeRealTimeGazeCallback() {
    realTimeGazeCallback = null;
  },

  getGazeHistory(duration = 5000) {
    const cutoff = Date.now() - duration;
    return gazeHistory.filter(gaze => gaze.timestamp >= cutoff);
  },

  getPerformanceMetrics() {
    return performanceMonitor ? performanceMonitor.getMetrics() : null;
  },

  // Professional gaze validation for exam monitoring
  async validateGazeAttention(duration = 2000) {
    const startTime = Date.now();
    const samples = [];
    
    return new Promise((resolve) => {
      const collectSample = () => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= duration) {
          // Analysis complete
          const result = this.analyzeAttentionSamples(samples);
          resolve(result);
          return;
        }
        
        this.getCurrentGaze().then(gaze => {
          if (gaze) {
            samples.push(gaze);
          }
          setTimeout(collectSample, 100);
        });
      };
      
      collectSample();
    });
  },

  analyzeAttentionSamples(samples) {
    if (samples.length === 0) {
      return {
        isAttentive: false,
        confidence: 0,
        gazeStability: 0,
        screenCoverage: 0,
        averageConfidence: 0
      };
    }
    
    // Calculate gaze stability
    let totalMovement = 0;
    for (let i = 1; i < samples.length; i++) {
      const movement = Math.sqrt(
        Math.pow(samples[i].x - samples[i-1].x, 2) +
        Math.pow(samples[i].y - samples[i-1].y, 2)
      );
      totalMovement += movement;
    }
    
    const avgMovement = samples.length > 1 ? totalMovement / (samples.length - 1) : 0;
    const gazeStability = Math.max(0, 1 - (avgMovement / 100)); // 100px = 0 stability
    
    // Calculate screen coverage (how much of screen is being looked at)
    const gazePoints = samples.map(s => ({ x: s.x, y: s.y }));
    const screenCoverage = this.calculateScreenCoverage(gazePoints);
    
    // Calculate average confidence
    const avgConfidence = samples.reduce((sum, s) => sum + s.confidence, 0) / samples.length;
    
    // Determine if user is attentive
    const isAttentive = gazeStability > 0.6 && avgConfidence > 0.5 && samples.length >= 10;
    
    return {
      isAttentive,
      confidence: avgConfidence,
      gazeStability,
      screenCoverage,
      averageConfidence: avgConfidence,
      sampleCount: samples.length,
      totalMovement: avgMovement
    };
  },

  calculateScreenCoverage(gazePoints) {
    if (gazePoints.length === 0) return 0;
    
    // Divide screen into grid and check coverage
    const gridSize = 4; // 4x4 grid
    const cellWidth = window.innerWidth / gridSize;
    const cellHeight = window.innerHeight / gridSize;
    const coveredCells = new Set();
    
    gazePoints.forEach(point => {
      const cellX = Math.floor(point.x / cellWidth);
      const cellY = Math.floor(point.y / cellHeight);
      if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
        coveredCells.add(`${cellX},${cellY}`);
      }
    });
    
    return coveredCells.size / (gridSize * gridSize);
  },

  // Professional eye tracking for exam integrity
  async detectEyesOffScreen(threshold = 1000) {
    const recentGazes = this.getGazeHistory(threshold);
    
    if (recentGazes.length === 0) {
      return {
        eyesOffScreen: true,
        duration: threshold,
        confidence: 1.0
      };
    }
    
    // Check if recent gazes are outside screen bounds
    const offScreenGazes = recentGazes.filter(gaze => 
      gaze.x < 0 || gaze.x > window.innerWidth ||
      gaze.y < 0 || gaze.y > window.innerHeight ||
      gaze.confidence < 0.3
    );
    
    const offScreenRatio = offScreenGazes.length / recentGazes.length;
    
    return {
      eyesOffScreen: offScreenRatio > 0.7, // 70% of recent gazes off screen
      duration: threshold,
      confidence: offScreenRatio,
      recentGazeCount: recentGazes.length,
      offScreenCount: offScreenGazes.length
    };
  },

  // Advanced calibration validation
  async recalibrateIfNeeded() {
    if (!this.isReady()) return false;
    
    const accuracy = await this.testCalibrationAccuracy();
    
    if (accuracy < 0.6) {
      console.log('Calibration accuracy degraded, recalibration recommended');
      return true; // Needs recalibration
    }
    
    return false;
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