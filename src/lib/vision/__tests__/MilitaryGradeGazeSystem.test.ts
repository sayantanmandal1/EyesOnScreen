/**
 * Tests for Military-Grade Gaze System Integration
 */

import { MilitaryGradeGazeSystem, MilitaryGradeConfig } from '../MilitaryGradeGazeSystem';

// Mock ImageData for testing environment
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

// Set up global ImageData mock
(global as any).ImageData = MockImageData;

describe('MilitaryGradeGazeSystem', () => {
  let system: MilitaryGradeGazeSystem;
  let config: Partial<MilitaryGradeConfig>;

  beforeEach(async () => {
    config = {
      precisionThreshold: 1.0,
      confidenceThreshold: 0.7,
      screenGeometry: {
        width: 1920,
        height: 1080,
        distance: 600,
        position: { x: 0, y: 0, z: 0 }
      },
      alertThresholds: {
        offScreenDuration: 2000,
        deviationLimit: 2.0,
        confidenceLimit: 0.5
      }
    };

    system = new MilitaryGradeGazeSystem(config);
    await system.initialize();
  });

  afterEach(() => {
    system.shutdown();
  });

  describe('System Initialization', () => {
    it('should initialize successfully', async () => {
      const newSystem = new MilitaryGradeGazeSystem();
      await expect(newSystem.initialize()).resolves.not.toThrow();
      
      const status = newSystem.getMonitoringStatus();
      expect(status.isActive).toBe(true);
      
      newSystem.shutdown();
    });

    it('should apply custom configuration', () => {
      const customConfig: Partial<MilitaryGradeConfig> = {
        precisionThreshold: 0.5,
        confidenceThreshold: 0.8
      };

      const customSystem = new MilitaryGradeGazeSystem(customConfig);
      
      // Configuration should be applied (we can't directly access private config, 
      // but we can test through behavior)
      expect(customSystem).toBeDefined();
    });
  });

  describe('Frame Processing', () => {
    it('should process frame with military-grade analysis', async () => {
      const imageData = createMockImageData(640, 480);
      const faceLandmarks = createMockFaceLandmarks();
      const headPose = { yaw: 0, pitch: 0, roll: 0 };
      const eyeRegions = {
        left: { x: 200, y: 200, width: 100, height: 50 },
        right: { x: 340, y: 200, width: 100, height: 50 }
      };

      const result = await system.processFrame(imageData, faceLandmarks, headPose, eyeRegions);

      expect(result).toBeDefined();
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.leftIris).toBeDefined();
      expect(result.rightIris).toBeDefined();
      expect(result.gazeVector).toBeDefined();
      expect(result.screenIntersection).toBeDefined();
      expect(result.deviationAnalysis).toBeDefined();
      expect(result.blinkPattern).toBeDefined();
      expect(result.eyeMovements).toBeDefined();
      expect(result.attentionFocus).toBeDefined();
      expect(result.temporalConsistency).toBeDefined();
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
      expect(result.securityRisk).toMatch(/none|low|medium|high/);
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    it('should detect high-quality gaze tracking', async () => {
      const imageData = createMockHighQualityImageData(640, 480);
      const faceLandmarks = createMockFaceLandmarks();
      const headPose = { yaw: 0, pitch: 0, roll: 0 };
      const eyeRegions = {
        left: { x: 200, y: 200, width: 100, height: 50 },
        right: { x: 340, y: 200, width: 100, height: 50 }
      };

      const result = await system.processFrame(imageData, faceLandmarks, headPose, eyeRegions);

      expect(result.overallConfidence).toBeGreaterThan(0.5);
      expect(result.leftIris.confidence).toBeGreaterThan(0);
      expect(result.rightIris.confidence).toBeGreaterThan(0);
      expect(result.gazeVector.confidence).toBeGreaterThan(0);
    });

    it('should handle multiple consecutive frames', async () => {
      const imageData = createMockImageData(640, 480);
      const faceLandmarks = createMockFaceLandmarks();
      const headPose = { yaw: 0, pitch: 0, roll: 0 };
      const eyeRegions = {
        left: { x: 200, y: 200, width: 100, height: 50 },
        right: { x: 340, y: 200, width: 100, height: 50 }
      };

      // Process multiple frames
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await system.processFrame(imageData, faceLandmarks, headPose, eyeRegions);
        results.push(result);
        
        // Small delay between frames
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(results.length).toBe(5);
      
      // Each frame should have valid data
      results.forEach(result => {
        expect(result.timestamp).toBeGreaterThan(0);
        expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      });

      // Timestamps should be increasing
      for (let i = 1; i < results.length; i++) {
        expect(results[i].timestamp).toBeGreaterThan(results[i-1].timestamp);
      }
    });
  });

  describe('Security Risk Assessment', () => {
    it('should detect low security risk for normal behavior', async () => {
      const imageData = createMockHighQualityImageData(640, 480);
      const faceLandmarks = createMockFaceLandmarks();
      const headPose = { yaw: 0, pitch: 0, roll: 0 };
      const eyeRegions = {
        left: { x: 200, y: 200, width: 100, height: 50 },
        right: { x: 340, y: 200, width: 100, height: 50 }
      };

      const result = await system.processFrame(imageData, faceLandmarks, headPose, eyeRegions);

      expect(['none', 'low']).toContain(result.securityRisk);
    });

    it('should generate appropriate alerts', async () => {
      const imageData = createMockImageData(640, 480);
      const faceLandmarks = createMockFaceLandmarks();
      const headPose = { yaw: 0, pitch: 0, roll: 0 };
      const eyeRegions = {
        left: { x: 200, y: 200, width: 100, height: 50 },
        right: { x: 340, y: 200, width: 100, height: 50 }
      };

      const result = await system.processFrame(imageData, faceLandmarks, headPose, eyeRegions);

      expect(Array.isArray(result.alerts)).toBe(true);
      // Alerts should be strings
      result.alerts.forEach(alert => {
        expect(typeof alert).toBe('string');
      });
    });
  });

  describe('Monitoring Status', () => {
    it('should provide real-time monitoring status', async () => {
      // Process a few frames first
      const imageData = createMockImageData(640, 480);
      const faceLandmarks = createMockFaceLandmarks();
      const headPose = { yaw: 0, pitch: 0, roll: 0 };
      const eyeRegions = {
        left: { x: 200, y: 200, width: 100, height: 50 },
        right: { x: 340, y: 200, width: 100, height: 50 }
      };

      for (let i = 0; i < 3; i++) {
        await system.processFrame(imageData, faceLandmarks, headPose, eyeRegions);
      }

      const status = system.getMonitoringStatus();

      expect(status).toBeDefined();
      expect(status.isActive).toBe(true);
      expect(status.currentPrecision).toBeGreaterThanOrEqual(0);
      expect(status.currentPrecision).toBeLessThanOrEqual(1);
      expect(status.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(status.averageConfidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(status.recentAlerts)).toBe(true);
      expect(status.systemHealth).toMatch(/excellent|good|fair|poor/);
    });

    it('should track system health correctly', async () => {
      const status = system.getMonitoringStatus();
      
      // Initially should be poor due to no data
      expect(status.systemHealth).toBe('poor');
      expect(status.currentPrecision).toBe(0);
      expect(status.averageConfidence).toBe(0);
    });
  });

  describe('Analysis Report', () => {
    it('should generate comprehensive analysis report', async () => {
      // Process some frames
      const imageData = createMockImageData(640, 480);
      const faceLandmarks = createMockFaceLandmarks();
      const headPose = { yaw: 0, pitch: 0, roll: 0 };
      const eyeRegions = {
        left: { x: 200, y: 200, width: 100, height: 50 },
        right: { x: 340, y: 200, width: 100, height: 50 }
      };

      for (let i = 0; i < 5; i++) {
        await system.processFrame(imageData, faceLandmarks, headPose, eyeRegions);
      }

      const report = system.getAnalysisReport();

      expect(report).toBeDefined();
      expect(report.totalFramesProcessed).toBe(5);
      expect(report.averagePrecision).toBeGreaterThanOrEqual(0);
      expect(report.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(report.securityIncidents).toBeGreaterThanOrEqual(0);
      expect(report.behaviorSummary).toBeDefined();
      expect(report.performanceMetrics).toBeDefined();
      expect(report.performanceMetrics.precisionAchievement).toBeGreaterThanOrEqual(0);
      expect(report.performanceMetrics.precisionAchievement).toBeLessThanOrEqual(100);
      expect(report.performanceMetrics.confidenceStability).toBeGreaterThanOrEqual(0);
      expect(report.performanceMetrics.alertFrequency).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty data gracefully', () => {
      const report = system.getAnalysisReport();

      expect(report.totalFramesProcessed).toBe(0);
      expect(report.averagePrecision).toBe(0);
      expect(report.averageConfidence).toBe(0);
      expect(report.securityIncidents).toBe(0);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig: Partial<MilitaryGradeConfig> = {
        precisionThreshold: 0.5,
        confidenceThreshold: 0.9
      };

      expect(() => system.updateConfig(newConfig)).not.toThrow();
    });

    it('should update screen geometry', () => {
      const newConfig: Partial<MilitaryGradeConfig> = {
        screenGeometry: {
          width: 2560,
          height: 1440,
          distance: 700,
          position: { x: 0, y: 0, z: 0 }
        }
      };

      expect(() => system.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('Data Export', () => {
    it('should export system data correctly', async () => {
      // Process some frames first
      const imageData = createMockImageData(640, 480);
      const faceLandmarks = createMockFaceLandmarks();
      const headPose = { yaw: 0, pitch: 0, roll: 0 };
      const eyeRegions = {
        left: { x: 200, y: 200, width: 100, height: 50 },
        right: { x: 340, y: 200, width: 100, height: 50 }
      };

      await system.processFrame(imageData, faceLandmarks, headPose, eyeRegions);

      const exportData = system.exportData();

      expect(exportData).toBeDefined();
      expect(exportData.config).toBeDefined();
      expect(Array.isArray(exportData.dataHistory)).toBe(true);
      expect(exportData.exportTimestamp).toBeGreaterThan(0);
      expect(exportData.systemInfo).toBeDefined();
      expect(exportData.systemInfo.version).toBeDefined();
      expect(Array.isArray(exportData.systemInfo.capabilities)).toBe(true);
      
      // Check capabilities
      const capabilities = exportData.systemInfo.capabilities;
      expect(capabilities).toContain('Sub-pixel iris tracking');
      expect(capabilities).toContain('1-degree gaze precision');
      expect(capabilities).toContain('Military-grade security assessment');
    });
  });

  describe('System Lifecycle', () => {
    it('should reset system state correctly', async () => {
      // Process some frames
      const imageData = createMockImageData(640, 480);
      const faceLandmarks = createMockFaceLandmarks();
      const headPose = { yaw: 0, pitch: 0, roll: 0 };
      const eyeRegions = {
        left: { x: 200, y: 200, width: 100, height: 50 },
        right: { x: 340, y: 200, width: 100, height: 50 }
      };

      await system.processFrame(imageData, faceLandmarks, headPose, eyeRegions);
      
      let report = system.getAnalysisReport();
      expect(report.totalFramesProcessed).toBeGreaterThan(0);

      // Reset system
      system.reset();

      report = system.getAnalysisReport();
      expect(report.totalFramesProcessed).toBe(0);
    });

    it('should shutdown gracefully', () => {
      const status = system.getMonitoringStatus();
      expect(status.isActive).toBe(true);

      system.shutdown();

      const statusAfterShutdown = system.getMonitoringStatus();
      expect(statusAfterShutdown.isActive).toBe(false);
    });
  });

  // Helper functions
  function createMockImageData(width: number, height: number): any {
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Fill with realistic image data
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.floor(Math.random() * 256);     // R
      data[i + 1] = Math.floor(Math.random() * 256); // G
      data[i + 2] = Math.floor(Math.random() * 256); // B
      data[i + 3] = 255; // A
    }
    
    return new MockImageData(data, width, height);
  }

  function createMockHighQualityImageData(width: number, height: number): any {
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Create high-contrast, clear image data
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Create clear patterns for better iris detection
        const value = ((x + y) % 2) * 255;
        data[idx] = value;     // R
        data[idx + 1] = value; // G
        data[idx + 2] = value; // B
        data[idx + 3] = 255;   // A
      }
    }
    
    return new MockImageData(data, width, height);
  }

  function createMockFaceLandmarks(): Float32Array {
    // Create mock landmarks for 468 face points (MediaPipe format)
    const landmarks = new Float32Array(468 * 3);
    
    // Set realistic face structure
    for (let i = 0; i < 468; i++) {
      landmarks[i * 3] = 0.5 + (Math.random() - 0.5) * 0.2; // x
      landmarks[i * 3 + 1] = 0.5 + (Math.random() - 0.5) * 0.2; // y
      landmarks[i * 3 + 2] = Math.random() * 0.1; // z
    }
    
    return landmarks;
  }
});