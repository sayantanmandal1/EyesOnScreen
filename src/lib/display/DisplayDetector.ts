/**
 * Comprehensive Display Detection System
 * 
 * Detects multiple monitors, external displays, TVs, projectors, and virtual machine displays
 * using advanced browser APIs, reflection analysis, and eye movement correlation.
 */

import {
  DisplayDetectionConfig,
  DisplayInfo,
  DisplayDetectionResult,
  ReflectionDetection,
  EyeMovementAnalysis,
  SuspiciousPattern,
  DisplayThreat,
  DisplayEvent,
  DisplayEventHandler
} from './types';

export class DisplayDetector {
  private config: DisplayDetectionConfig;
  private eventHandlers: DisplayEventHandler[] = [];
  private monitoringInterval?: number;
  private lastDetectionResult?: DisplayDetectionResult;
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;

  constructor(config: DisplayDetectionConfig) {
    this.config = config;
    this.setupCanvas();
  }

  /**
   * Start continuous display monitoring
   */
  public startMonitoring(): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.monitoringInterval = window.setInterval(
      () => this.performDetection(),
      this.config.monitoring.intervalMs
    );

    // Initial detection
    this.performDetection();
  }

  /**
   * Stop display monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Perform comprehensive display detection
   */
  public async performDetection(): Promise<DisplayDetectionResult> {
    const displays = await this.detectDisplays();
    const reflectionScreens = this.config.monitoring.reflectionAnalysis 
      ? await this.detectReflectionBasedScreens() 
      : [];
    const eyeMovementAnalysis = this.config.monitoring.eyeMovementCorrelation
      ? await this.analyzeEyeMovementCorrelation()
      : this.getEmptyEyeMovementAnalysis();

    const result: DisplayDetectionResult = {
      displays,
      multipleDisplaysDetected: displays.length > 1,
      externalDisplaysDetected: displays.some(d => d.type === 'external'),
      tvProjectorDetected: displays.some(d => d.type === 'tv' || d.type === 'projector'),
      virtualDisplayDetected: displays.some(d => d.type === 'virtual'),
      reflectionBasedScreens: reflectionScreens,
      eyeMovementCorrelation: eyeMovementAnalysis,
      confidence: this.calculateOverallConfidence(displays, reflectionScreens, eyeMovementAnalysis),
      timestamp: Date.now()
    };

    this.lastDetectionResult = result;
    this.checkForThreats(result);
    this.emitEvent('display_change', result);

    return result;
  }

  /**
   * Detect all available displays using Screen API and browser heuristics
   */
  private async detectDisplays(): Promise<DisplayInfo[]> {
    const displays: DisplayInfo[] = [];

    try {
      // Primary display from screen object
      const primaryDisplay: DisplayInfo = {
        id: 'primary',
        isPrimary: true,
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        orientation: screen.orientation?.angle || 0,
        type: this.classifyDisplayType(screen.width, screen.height),
        connectionType: this.inferConnectionType(screen.width, screen.height)
      };

      displays.push(primaryDisplay);

      // Detect additional displays using various methods
      const additionalDisplays = await this.detectAdditionalDisplays();
      displays.push(...additionalDisplays);

      // Detect virtual machine displays
      const vmDisplays = this.detectVirtualMachineDisplays();
      displays.push(...vmDisplays);

    } catch (error) {
      console.warn('Display detection error:', error);
    }

    return displays;
  }

  /**
   * Detect additional displays using advanced browser APIs
   */
  private async detectAdditionalDisplays(): Promise<DisplayInfo[]> {
    const displays: DisplayInfo[] = [];

    try {
      // Try Screen Capture API to detect multiple screens
      if ('getDisplayMedia' in navigator.mediaDevices) {
        const screenSources = await this.enumerateScreenSources();
        displays.push(...screenSources);
      }

      // Check for window.screen.availWidth vs window.screen.width discrepancies
      const widthDiscrepancy = Math.abs(screen.availWidth - screen.width);
      const heightDiscrepancy = Math.abs(screen.availHeight - screen.height);
      
      if (widthDiscrepancy > 100 || heightDiscrepancy > 100) {
        displays.push({
          id: 'detected-secondary',
          isPrimary: false,
          width: widthDiscrepancy,
          height: heightDiscrepancy,
          colorDepth: screen.colorDepth,
          pixelRatio: window.devicePixelRatio,
          orientation: 0,
          type: 'external'
        });
      }

      // Check for unusual aspect ratios indicating multiple displays
      const aspectRatio = screen.width / screen.height;
      if (aspectRatio > 3.0 || aspectRatio < 0.5) {
        displays.push({
          id: 'ultra-wide-detected',
          isPrimary: false,
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth,
          pixelRatio: window.devicePixelRatio,
          orientation: 0,
          type: this.aspectRatio > 3.0 ? 'external' : 'unknown'
        });
      }

    } catch (error) {
      console.warn('Additional display detection failed:', error);
    }

    return displays;
  }

  /**
   * Enumerate screen sources using Screen Capture API
   */
  private async enumerateScreenSources(): Promise<DisplayInfo[]> {
    const displays: DisplayInfo[] = [];

    try {
      // Request screen capture to enumerate available screens
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      });

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      
      if (settings.displaySurface === 'monitor') {
        displays.push({
          id: `screen-${settings.deviceId || 'unknown'}`,
          isPrimary: false,
          width: settings.width || 0,
          height: settings.height || 0,
          colorDepth: 24,
          pixelRatio: 1,
          orientation: 0,
          type: 'external'
        });
      }

      // Stop the stream immediately
      stream.getTracks().forEach(track => track.stop());

    } catch (error) {
      // Screen capture denied or not available
      console.debug('Screen capture enumeration failed:', error);
    }

    return displays;
  }

  /**
   * Detect virtual machine displays using various heuristics
   */
  private detectVirtualMachineDisplays(): DisplayInfo[] {
    const displays: DisplayInfo[] = [];

    // Common VM display resolutions
    const vmResolutions = [
      { width: 1024, height: 768 },
      { width: 1280, height: 1024 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 }
    ];

    const currentRes = { width: screen.width, height: screen.height };
    const isVMResolution = vmResolutions.some(vm => 
      vm.width === currentRes.width && vm.height === currentRes.height
    );

    // Check for VM-specific display characteristics
    const hasVMCharacteristics = 
      screen.colorDepth === 16 || // Common in VMs
      window.devicePixelRatio === 1.0 || // VMs often don't support high DPI
      screen.orientation?.angle === undefined; // Limited orientation support

    if (isVMResolution || hasVMCharacteristics) {
      displays.push({
        id: 'vm-display-detected',
        isPrimary: false,
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        orientation: screen.orientation?.angle || 0,
        type: 'virtual'
      });
    }

    return displays;
  }

  /**
   * Detect reflection-based screens using computer vision
   */
  private async detectReflectionBasedScreens(): Promise<ReflectionDetection[]> {
    const reflections: ReflectionDetection[] = [];

    try {
      if (!this.canvas || !this.ctx) {
        return reflections;
      }

      // Get video stream for reflection analysis
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });

      // Capture frame for analysis
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;
      this.ctx.drawImage(video, 0, 0);

      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      // Analyze for screen reflections
      const detectedReflections = this.analyzeReflections(imageData);
      reflections.push(...detectedReflections);

      // Clean up
      stream.getTracks().forEach(track => track.stop());
      video.remove();

    } catch (error) {
      console.warn('Reflection detection failed:', error);
    }

    return reflections;
  }

  /**
   * Analyze image data for screen reflections
   */
  private analyzeReflections(imageData: ImageData): ReflectionDetection[] {
    const reflections: ReflectionDetection[] = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Look for rectangular bright areas that could be screens
    const brightRegions = this.findBrightRectangularRegions(data, width, height);
    
    for (const region of brightRegions) {
      const reflection: ReflectionDetection = {
        screenId: `reflection-${reflections.length}`,
        confidence: region.confidence,
        location: region.bounds,
        reflectionType: this.classifyReflectionType(region),
        brightness: region.brightness,
        colorProfile: region.colorProfile
      };

      if (reflection.confidence > this.config.thresholds.reflectionConfidence) {
        reflections.push(reflection);
      }
    }

    return reflections;
  }

  /**
   * Find bright rectangular regions in image data
   */
  private findBrightRectangularRegions(data: Uint8ClampedArray, width: number, height: number) {
    const regions: any[] = [];
    const brightnessThreshold = 200;
    const minRegionSize = 50;

    // Simple edge detection and region growing
    for (let y = 0; y < height - minRegionSize; y += 10) {
      for (let x = 0; x < width - minRegionSize; x += 10) {
        const region = this.growBrightRegion(data, width, height, x, y, brightnessThreshold);
        
        if (region && region.area > minRegionSize * minRegionSize) {
          const aspectRatio = region.width / region.height;
          
          // Check if region has screen-like aspect ratio
          if (aspectRatio > 1.2 && aspectRatio < 2.5) {
            regions.push({
              bounds: { x: region.x, y: region.y, width: region.width, height: region.height },
              confidence: Math.min(region.brightness / 255, 1.0),
              brightness: region.brightness,
              colorProfile: region.colorProfile,
              area: region.area
            });
          }
        }
      }
    }

    return regions;
  }

  /**
   * Grow a bright region from a seed point
   */
  private growBrightRegion(data: Uint8ClampedArray, width: number, height: number, 
                          startX: number, startY: number, threshold: number) {
    // Simplified region growing algorithm
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
    let totalBrightness = 0;
    let pixelCount = 0;
    const colorProfile = [0, 0, 0];

    // Sample a small region around the start point
    for (let y = startY; y < Math.min(startY + 20, height); y++) {
      for (let x = startX; x < Math.min(startX + 20, width); x++) {
        const idx = (y * width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        
        if (brightness > threshold) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          totalBrightness += brightness;
          colorProfile[0] += data[idx];
          colorProfile[1] += data[idx + 1];
          colorProfile[2] += data[idx + 2];
          pixelCount++;
        }
      }
    }

    if (pixelCount === 0) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      area: (maxX - minX) * (maxY - minY),
      brightness: totalBrightness / pixelCount,
      colorProfile: colorProfile.map(c => c / pixelCount)
    };
  }

  /**
   * Classify the type of reflection detected
   */
  private classifyReflectionType(region: any): 'monitor' | 'tv' | 'mobile' | 'tablet' | 'unknown' {
    const aspectRatio = region.bounds.width / region.bounds.height;
    const area = region.bounds.width * region.bounds.height;

    if (aspectRatio > 1.5 && aspectRatio < 1.8 && area > 5000) {
      return 'monitor';
    } else if (aspectRatio > 1.7 && area > 10000) {
      return 'tv';
    } else if (aspectRatio > 0.5 && aspectRatio < 0.7 && area < 2000) {
      return 'mobile';
    } else if (aspectRatio > 1.2 && aspectRatio < 1.4 && area < 5000) {
      return 'tablet';
    }

    return 'unknown';
  }

  /**
   * Analyze eye movement correlation with potential external screens
   */
  private async analyzeEyeMovementCorrelation(): Promise<EyeMovementAnalysis> {
    // This would integrate with the existing gaze tracking system
    // For now, return a placeholder implementation
    return {
      correlationScore: 0.0,
      suspiciousPatterns: [],
      offScreenGazeDetected: false,
      externalScreenInteraction: false,
      confidence: 0.0
    };
  }

  /**
   * Get empty eye movement analysis
   */
  private getEmptyEyeMovementAnalysis(): EyeMovementAnalysis {
    return {
      correlationScore: 0.0,
      suspiciousPatterns: [],
      offScreenGazeDetected: false,
      externalScreenInteraction: false,
      confidence: 0.0
    };
  }

  /**
   * Classify display type based on resolution and characteristics
   */
  private classifyDisplayType(width: number, height: number): DisplayInfo['type'] {
    const aspectRatio = width / height;
    const totalPixels = width * height;

    // TV/Projector detection (typically 16:9 and large)
    if (Math.abs(aspectRatio - 16/9) < 0.1 && totalPixels > 2073600) { // > 1920x1080
      return 'tv';
    }

    // Ultra-wide monitors
    if (aspectRatio > 2.5) {
      return 'external';
    }

    // Standard monitor resolutions
    const commonMonitorResolutions = [
      { w: 1920, h: 1080 }, { w: 2560, h: 1440 }, { w: 3840, h: 2160 },
      { w: 1680, h: 1050 }, { w: 2560, h: 1600 }
    ];

    const isCommonMonitor = commonMonitorResolutions.some(res => 
      Math.abs(res.w - width) < 50 && Math.abs(res.h - height) < 50
    );

    if (isCommonMonitor) {
      return 'external';
    }

    return 'internal';
  }

  /**
   * Infer connection type based on display characteristics
   */
  private inferConnectionType(width: number, height: number): DisplayInfo['connectionType'] {
    const totalPixels = width * height;

    if (totalPixels >= 3840 * 2160) {
      return 'displayport'; // 4K typically uses DisplayPort or HDMI 2.0+
    } else if (totalPixels >= 2560 * 1440) {
      return 'hdmi';
    } else if (totalPixels >= 1920 * 1080) {
      return 'hdmi';
    }

    return 'unknown';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    displays: DisplayInfo[], 
    reflections: ReflectionDetection[], 
    eyeAnalysis: EyeMovementAnalysis
  ): number {
    let confidence = 0.8; // Base confidence

    // Reduce confidence for multiple displays
    if (displays.length > 1) {
      confidence *= 0.9;
    }

    // Factor in reflection detection confidence
    if (reflections.length > 0) {
      const avgReflectionConfidence = reflections.reduce((sum, r) => sum + r.confidence, 0) / reflections.length;
      confidence = (confidence + avgReflectionConfidence) / 2;
    }

    // Factor in eye movement analysis
    confidence = (confidence + eyeAnalysis.confidence) / 2;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Check for display-related threats
   */
  private checkForThreats(result: DisplayDetectionResult): void {
    const threats: DisplayThreat[] = [];

    if (result.multipleDisplaysDetected) {
      threats.push({
        id: `multiple-displays-${Date.now()}`,
        type: 'multiple_displays',
        severity: 'high',
        message: `Multiple displays detected: ${result.displays.length} displays found`,
        details: { displays: result.displays },
        timestamp: Date.now(),
        resolved: false
      });
    }

    if (result.externalDisplaysDetected) {
      threats.push({
        id: `external-display-${Date.now()}`,
        type: 'external_display',
        severity: 'high',
        message: 'External display connection detected',
        details: { externalDisplays: result.displays.filter(d => d.type === 'external') },
        timestamp: Date.now(),
        resolved: false
      });
    }

    if (result.tvProjectorDetected) {
      threats.push({
        id: `tv-projector-${Date.now()}`,
        type: 'tv_projector',
        severity: 'critical',
        message: 'TV or projector detected',
        details: { tvProjectors: result.displays.filter(d => d.type === 'tv' || d.type === 'projector') },
        timestamp: Date.now(),
        resolved: false
      });
    }

    if (result.virtualDisplayDetected) {
      threats.push({
        id: `vm-display-${Date.now()}`,
        type: 'vm_display',
        severity: 'critical',
        message: 'Virtual machine display detected',
        details: { vmDisplays: result.displays.filter(d => d.type === 'virtual') },
        timestamp: Date.now(),
        resolved: false
      });
    }

    if (result.reflectionBasedScreens.length > 0) {
      threats.push({
        id: `reflection-screens-${Date.now()}`,
        type: 'reflection_screen',
        severity: 'medium',
        message: `${result.reflectionBasedScreens.length} reflection-based screens detected`,
        details: { reflections: result.reflectionBasedScreens },
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Emit threat events
    threats.forEach(threat => {
      this.emitEvent('threat_detected', threat);
    });
  }

  /**
   * Setup canvas for image processing
   */
  private setupCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Add event handler
   */
  public addEventListener(handler: DisplayEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove event handler
   */
  public removeEventListener(handler: DisplayEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index > -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Emit display event
   */
  private emitEvent(type: DisplayEvent['type'], data: any): void {
    const event: DisplayEvent = {
      type,
      data,
      timestamp: Date.now()
    };

    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Display event handler error:', error);
      }
    });
  }

  /**
   * Get last detection result
   */
  public getLastDetectionResult(): DisplayDetectionResult | undefined {
    return this.lastDetectionResult;
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopMonitoring();
    this.eventHandlers.length = 0;
    
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = undefined;
      this.ctx = undefined;
    }
  }
}