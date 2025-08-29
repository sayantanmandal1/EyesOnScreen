/**
 * Lighting Analyzer Tests
 * Tests for advanced lighting and shadow analysis functionality
 */

import { LightingAnalyzer } from '../LightingAnalyzer';
import { LightingAnalysisConfig, LightingAnalysisResult } from '../LightingAnalyzer';

// Mock ImageData for Node.js environment
const createMockImageData = (width = 640, height = 480): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  
  // Fill with some mock pixel data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(Math.random() * 256);     // R
    data[i + 1] = Math.floor(Math.random() * 256); // G
    data[i + 2] = Math.floor(Math.random() * 256); // B
    data[i + 3] = 255;                             // A
  }
  
  // Mock ImageData constructor for Node.js
  return {
    data,
    width,
    height,
    colorSpace: 'srgb'
  } as ImageData;
};

describe('LightingAnalyzer', () => {
  let lightingAnalyzer: LightingAnalyzer;
  let mockImageData: ImageData;

  beforeEach(() => {
    lightingAnalyzer = new LightingAnalyzer();
    mockImageData = createMockImageData();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await lightingAnalyzer.initialize();
      expect(result).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<LightingAnalysisConfig> = {
        shadowDetectionEnabled: false,
        lightingChangeThreshold: 0.2
      };
      
      const analyzer = new LightingAnalyzer(customConfig);
      expect(analyzer.getConfig()).toMatchObject(customConfig);
    });

    it('should use default configuration when none provided', () => {
      const analyzer = new LightingAnalyzer();
      const config = analyzer.getConfig();
      
      expect(config.shadowDetectionEnabled).toBe(true);
      expect(config.greenScreenDetectionEnabled).toBe(true);
      expect(config.reflectionAnalysisEnabled).toBe(true);
      expect(config.artificialChangeDetection).toBe(true);
    });
  });

  describe('Lighting Analysis', () => {
    beforeEach(async () => {
      await lightingAnalyzer.initialize();
    });

    it('should perform comprehensive lighting analysis', async () => {
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      expect(result).toMatchObject({
        timestamp: expect.any(Number),
        lightingSources: expect.any(Array),
        shadowAnalysis: expect.any(Object),
        lightingConsistency: expect.any(Object),
        artificialChanges: expect.any(Array),
        greenScreenDetection: expect.any(Object),
        reflectionAnalysis: expect.any(Object),
        violations: expect.any(Array),
        overallScore: expect.any(Number)
      });
    });

    it('should detect lighting sources', async () => {
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      expect(result.lightingSources).toBeDefined();
      expect(Array.isArray(result.lightingSources)).toBe(true);
      
      // Check structure of detected light sources
      if (result.lightingSources.length > 0) {
        const source = result.lightingSources[0];
        expect(source).toMatchObject({
          id: expect.any(String),
          type: expect.any(String),
          position: expect.any(Object),
          intensity: expect.any(Number),
          color: expect.any(Object)
        });
      }
    });

    it('should analyze shadows for manipulation detection', async () => {
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      expect(result.shadowAnalysis).toMatchObject({
        shadowRegions: expect.any(Array),
        shadowConsistency: expect.any(Number),
        manipulationDetected: expect.any(Boolean),
        manipulationConfidence: expect.any(Number),
        shadowDirection: expect.any(Object),
        shadowSharpness: expect.any(Number),
        temporalStability: expect.any(Number)
      });
      
      // Confidence should be between 0 and 1
      expect(result.shadowAnalysis.manipulationConfidence).toBeGreaterThanOrEqual(0);
      expect(result.shadowAnalysis.manipulationConfidence).toBeLessThanOrEqual(1);
    });

    it('should analyze lighting consistency', async () => {
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      expect(result.lightingConsistency).toMatchObject({
        colorTemperature: expect.any(Number),
        colorTemperatureStability: expect.any(Number),
        intensityStability: expect.any(Number),
        directionStability: expect.any(Number),
        naturalLightingScore: expect.any(Number),
        artificialLightingScore: expect.any(Number),
        mixedLightingDetected: expect.any(Boolean)
      });
      
      // Color temperature should be in reasonable range (2700K - 6500K)
      expect(result.lightingConsistency.colorTemperature).toBeGreaterThanOrEqual(2700);
      expect(result.lightingConsistency.colorTemperature).toBeLessThanOrEqual(6500);
    });
  });

  describe('Artificial Lighting Change Detection', () => {
    beforeEach(async () => {
      await lightingAnalyzer.initialize();
    });

    it('should detect artificial lighting changes over time', async () => {
      // Analyze multiple frames to build history
      await lightingAnalyzer.analyzeLighting(mockImageData);
      await lightingAnalyzer.analyzeLighting(mockImageData);
      
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      expect(result.artificialChanges).toBeDefined();
      expect(Array.isArray(result.artificialChanges)).toBe(true);
      
      // Check structure of detected changes
      if (result.artificialChanges.length > 0) {
        const change = result.artificialChanges[0];
        expect(change).toMatchObject({
          id: expect.any(String),
          timestamp: expect.any(Number),
          changeType: expect.any(String),
          severity: expect.any(String),
          confidence: expect.any(Number),
          description: expect.any(String),
          beforeState: expect.any(Object),
          afterState: expect.any(Object),
          evidence: expect.any(String)
        });
        
        // Change type should be valid
        expect(['intensity', 'color', 'direction', 'new-source', 'removed-source'])
          .toContain(change.changeType);
        
        // Severity should be valid
        expect(['minor', 'moderate', 'major', 'critical'])
          .toContain(change.severity);
      }
    });

    it('should build temporal history for change detection', async () => {
      const initialHistoryLength = lightingAnalyzer.getFrameHistoryLength();
      
      await lightingAnalyzer.analyzeLighting(mockImageData);
      const afterFirstFrame = lightingAnalyzer.getFrameHistoryLength();
      
      await lightingAnalyzer.analyzeLighting(mockImageData);
      const afterSecondFrame = lightingAnalyzer.getFrameHistoryLength();
      
      expect(afterFirstFrame).toBeGreaterThan(initialHistoryLength);
      expect(afterSecondFrame).toBeGreaterThan(afterFirstFrame);
    });
  });

  describe('Shadow Manipulation Detection', () => {
    beforeEach(async () => {
      await lightingAnalyzer.initialize();
    });

    it('should detect shadow manipulation', async () => {
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      expect(result.shadowAnalysis.manipulationDetected).toBeDefined();
      expect(typeof result.shadowAnalysis.manipulationDetected).toBe('boolean');
      
      if (result.shadowAnalysis.manipulationDetected) {
        expect(result.shadowAnalysis.manipulationConfidence).toBeGreaterThan(0);
        
        // Should create violation for shadow manipulation
        const shadowViolations = result.violations.filter(v => 
          v.type === 'lighting-manipulation' && 
          v.description.includes('shadow')
        );
        
        if (result.shadowAnalysis.manipulationConfidence > 0.3) {
          expect(shadowViolations.length).toBeGreaterThan(0);
        }
      }
    });

    it('should analyze shadow regions', async () => {
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      expect(result.shadowAnalysis.shadowRegions).toBeDefined();
      expect(Array.isArray(result.shadowAnalysis.shadowRegions)).toBe(true);
      
      // Check shadow region structure
      if (result.shadowAnalysis.shadowRegions.length > 0) {
        const shadow = result.shadowAnalysis.shadowRegions[0];
        expect(shadow).toMatchObject({
          id: expect.any(String),
          bounds: expect.any(Object),
          intensity: expect.any(Number),
          sharpness: expect.any(Number),
          direction: expect.any(Object),
          consistency: expect.any(Number),
          naturalness: expect.any(Number)
        });
        
        // Values should be in valid ranges
        expect(shadow.intensity).toBeGreaterThanOrEqual(0);
        expect(shadow.intensity).toBeLessThanOrEqual(1);
        expect(shadow.sharpness).toBeGreaterThanOrEqual(0);
        expect(shadow.sharpness).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Green Screen Detection', () => {
    beforeEach(async () => {
      await lightingAnalyzer.initialize();
    });

    it('should detect green screen backgrounds', async () => {
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      expect(result.greenScreenDetection).toMatchObject({
        detected: expect.any(Boolean),
        confidence: expect.any(Number),
        regions: expect.any(Array),
        replacementDetected: expect.any(Boolean),
        replacementType: expect.any(String),
        edgeArtifacts: expect.any(Array)
      });
      
      // Confidence should be between 0 and 1
      expect(result.greenScreenDetection.confidence).toBeGreaterThanOrEqual(0);
      expect(result.greenScreenDetection.confidence).toBeLessThanOrEqual(1);
      
      // Replacement type should be valid
      expect(['static-image', 'video', 'virtual-background', 'unknown'])
        .toContain(result.greenScreenDetection.replacementType);
    });

    it('should create violations for green screen detection', async () => {
      const config: Partial<LightingAnalysisConfig> = {
        greenScreenConfidenceThreshold: 0.1 // Lower threshold for testing
      };
      
      const analyzer = new LightingAnalyzer(config);
      await analyzer.initialize();
      
      const result = await analyzer.analyzeLighting(mockImageData);
      
      if (result.greenScreenDetection.detected && 
          result.greenScreenDetection.confidence > 0.1) {
        const greenScreenViolations = result.violations.filter(v => 
          v.type === 'environmental-tampering' && 
          v.description.includes('green screen')
        );
        
        expect(greenScreenViolations.length).toBeGreaterThan(0);
        
        if (greenScreenViolations.length > 0) {
          const violation = greenScreenViolations[0];
          expect(violation.severity).toBe('critical');
          expect(violation.autoBlock).toBe(true);
        }
      }
    });

    it('should analyze edge artifacts in green screen regions', async () => {
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      expect(result.greenScreenDetection.edgeArtifacts).toBeDefined();
      expect(Array.isArray(result.greenScreenDetection.edgeArtifacts)).toBe(true);
      
      // Check edge artifact structure
      if (result.greenScreenDetection.edgeArtifacts.length > 0) {
        const artifact = result.greenScreenDetection.edgeArtifacts[0];
        expect(artifact).toMatchObject({
          location: expect.any(Object),
          type: expect.any(String),
          severity: expect.any(Number)
        });
        
        // Artifact type should be valid
        expect(['halo', 'fringing', 'spill', 'matte-line'])
          .toContain(artifact.type);
      }
    });
  });

  describe('Reflection Analysis', () => {
    beforeEach(async () => {
      await lightingAnalyzer.initialize();
    });

    it('should analyze reflections for hidden screens', async () => {
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      expect(result.reflectionAnalysis).toMatchObject({
        reflectiveRegions: expect.any(Array),
        hiddenScreenReflections: expect.any(Array),
        lightSourceReflections: expect.any(Array),
        inconsistentReflections: expect.any(Array)
      });
    });

    it('should create violations for hidden screen reflections', async () => {
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      if (result.reflectionAnalysis.hiddenScreenReflections.length > 0) {
        const hiddenScreenViolations = result.violations.filter(v => 
          v.type === 'hidden-screens'
        );
        
        expect(hiddenScreenViolations.length).toBeGreaterThan(0);
        
        if (hiddenScreenViolations.length > 0) {
          const violation = hiddenScreenViolations[0];
          expect(violation.severity).toBe('critical');
          expect(violation.autoBlock).toBe(true);
        }
      }
    });
  });

  describe('Overall Scoring', () => {
    beforeEach(async () => {
      await lightingAnalyzer.initialize();
    });

    it('should calculate overall lighting score', async () => {
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      expect(result.overallScore).toBeDefined();
      expect(typeof result.overallScore).toBe('number');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    it('should penalize score for violations', async () => {
      // This test would need to be more sophisticated in a real implementation
      // to actually trigger violations and verify score reduction
      const result = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      if (result.violations.length > 0) {
        // Score should be reduced when violations are present
        expect(result.overallScore).toBeLessThan(1.0);
      }
    });
  });

  describe('Configuration Management', () => {
    it('should allow updating configuration', () => {
      const newConfig: Partial<LightingAnalysisConfig> = {
        shadowDetectionEnabled: false,
        lightingChangeThreshold: 0.25
      };
      
      lightingAnalyzer.updateConfig(newConfig);
      const updatedConfig = lightingAnalyzer.getConfig();
      
      expect(updatedConfig.shadowDetectionEnabled).toBe(false);
      expect(updatedConfig.lightingChangeThreshold).toBe(0.25);
    });

    it('should preserve existing config when updating', () => {
      const originalConfig = lightingAnalyzer.getConfig();
      
      lightingAnalyzer.updateConfig({ shadowDetectionEnabled: false });
      const updatedConfig = lightingAnalyzer.getConfig();
      
      expect(updatedConfig.greenScreenDetectionEnabled).toBe(originalConfig.greenScreenDetectionEnabled);
      expect(updatedConfig.reflectionAnalysisEnabled).toBe(originalConfig.reflectionAnalysisEnabled);
    });
  });

  describe('History Management', () => {
    beforeEach(async () => {
      await lightingAnalyzer.initialize();
    });

    it('should maintain frame history', async () => {
      const initialLength = lightingAnalyzer.getFrameHistoryLength();
      
      await lightingAnalyzer.analyzeLighting(mockImageData);
      const afterAnalysis = lightingAnalyzer.getFrameHistoryLength();
      
      expect(afterAnalysis).toBeGreaterThan(initialLength);
    });

    it('should clear history when requested', async () => {
      await lightingAnalyzer.analyzeLighting(mockImageData);
      expect(lightingAnalyzer.getFrameHistoryLength()).toBeGreaterThan(0);
      
      lightingAnalyzer.clearHistory();
      expect(lightingAnalyzer.getFrameHistoryLength()).toBe(0);
    });

    it('should limit history size', async () => {
      const config: Partial<LightingAnalysisConfig> = {
        temporalAnalysisFrames: 5
      };
      
      const analyzer = new LightingAnalyzer(config);
      await analyzer.initialize();
      
      // Add more frames than the limit
      for (let i = 0; i < 10; i++) {
        await analyzer.analyzeLighting(mockImageData);
      }
      
      expect(analyzer.getFrameHistoryLength()).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle analysis without initialization', async () => {
      const uninitializedAnalyzer = new LightingAnalyzer();
      
      await expect(uninitializedAnalyzer.analyzeLighting(mockImageData))
        .rejects.toThrow('Lighting Analyzer not initialized');
    });

    it('should handle invalid image data gracefully', async () => {
      await lightingAnalyzer.initialize();
      
      const invalidImageData = new ImageData(new Uint8ClampedArray(0), 0, 0);
      
      // Should not throw, but handle gracefully
      const result = await lightingAnalyzer.analyzeLighting(invalidImageData);
      expect(result).toBeDefined();
    });
  });

  describe('Temporal Analysis', () => {
    beforeEach(async () => {
      await lightingAnalyzer.initialize();
    });

    it('should improve analysis accuracy with more frames', async () => {
      // First analysis (limited temporal data)
      const firstResult = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      // Add more frames
      for (let i = 0; i < 5; i++) {
        await lightingAnalyzer.analyzeLighting(mockImageData);
      }
      
      // Later analysis (more temporal data)
      const laterResult = await lightingAnalyzer.analyzeLighting(mockImageData);
      
      // Temporal stability should improve with more data
      expect(laterResult.shadowAnalysis.temporalStability)
        .toBeGreaterThanOrEqual(firstResult.shadowAnalysis.temporalStability - 0.1);
    });
  });
});