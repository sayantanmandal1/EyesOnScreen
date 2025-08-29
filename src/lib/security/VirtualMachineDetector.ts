/**
 * VirtualMachineDetector - Advanced virtual machine and emulated environment detection
 * 
 * Detects virtual machines, sandboxes, and emulated environments using multiple
 * detection techniques to prevent cheating through virtualization.
 */

import type { VMDetectionResult, SecurityThreat } from './types';

interface VMDetectionEvent {
  result: VMDetectionResult;
  threat?: SecurityThreat;
}

type VMDetectionEventHandler = (event: VMDetectionEvent) => void;

interface DetectionMethod {
  name: string;
  detect: () => Promise<boolean> | boolean;
  weight: number; // Confidence weight (0-1)
}

export class VirtualMachineDetector {
  private eventHandlers: Set<VMDetectionEventHandler> = new Set();
  private detectionMethods: DetectionMethod[] = [];
  private isDestroyed = false;

  constructor() {
    this.setupDetectionMethods();
  }

  /**
   * Perform comprehensive VM detection
   */
  async detect(): Promise<VMDetectionResult> {
    if (this.isDestroyed) {
      return this.createNegativeResult();
    }

    const results: { method: string; detected: boolean; weight: number }[] = [];
    let totalWeight = 0;
    let detectedWeight = 0;

    try {
      // Run all detection methods
      for (const method of this.detectionMethods) {
        try {
          const detected = await method.detect();
          results.push({
            method: method.name,
            detected,
            weight: method.weight
          });

          totalWeight += method.weight;
          if (detected) {
            detectedWeight += method.weight;
          }
        } catch (error) {
          console.warn(`VM detection method ${method.name} failed:`, error);
          // Continue with other methods
        }
      }

      // Calculate confidence score
      const confidence = totalWeight > 0 ? detectedWeight / totalWeight : 0;
      const isVirtualMachine = confidence > 0.3; // 30% threshold for VM detection
      const isEmulated = confidence > 0.5; // 50% threshold for emulation detection

      const detectionResult: VMDetectionResult = {
        isVirtualMachine,
        isEmulated,
        detectionMethods: results.filter(r => r.detected).map(r => r.method),
        confidence,
        details: {
          results,
          totalWeight,
          detectedWeight,
          timestamp: Date.now()
        }
      };

      // Emit threat if VM/emulation detected
      if (isVirtualMachine || isEmulated) {
        const threat: SecurityThreat = {
          id: `vm_detected_${Date.now()}`,
          type: 'vm_detected',
          severity: 'critical',
          message: `${isEmulated ? 'Emulated environment' : 'Virtual machine'} detected - quiz access blocked`,
          details: {
            confidence,
            detectionMethods: detectionResult.detectionMethods,
            isVirtualMachine,
            isEmulated
          },
          timestamp: Date.now(),
          resolved: false
        };

        this.emitEvent({ result: detectionResult, threat });
      } else {
        this.emitEvent({ result: detectionResult });
      }

      return detectionResult;
    } catch (error) {
      console.error('VM detection failed:', error);
      return this.createNegativeResult();
    }
  }

  /**
   * Add event handler
   */
  addEventListener(handler: VMDetectionEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  removeEventListener(handler: VMDetectionEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Destroy the detector
   */
  destroy(): void {
    if (this.isDestroyed) return;

    this.eventHandlers.clear();
    this.isDestroyed = true;
  }

  private setupDetectionMethods(): void {
    // Method 1: User Agent Analysis
    this.detectionMethods.push({
      name: 'user_agent_analysis',
      detect: () => {
        const userAgent = navigator.userAgent.toLowerCase();
        const vmIndicators = [
          'virtualbox', 'vmware', 'parallels', 'qemu', 'kvm',
          'xen', 'hyper-v', 'vbox', 'vm', 'virtual'
        ];
        return vmIndicators.some(indicator => userAgent.includes(indicator));
      },
      weight: 0.2
    });

    // Method 2: Hardware Concurrency Analysis
    this.detectionMethods.push({
      name: 'hardware_concurrency',
      detect: () => {
        const cores = navigator.hardwareConcurrency;
        // VMs often have unusual core counts (1, 2, or very high numbers)
        return cores === 1 || cores === 2 || cores > 16;
      },
      weight: 0.1
    });

    // Method 3: Memory Analysis
    this.detectionMethods.push({
      name: 'memory_analysis',
      detect: () => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          // VMs often have limited or unusual memory configurations
          const totalJSHeapSize = memory.totalJSHeapSize;
          const usedJSHeapSize = memory.usedJSHeapSize;
          
          // Suspicious if total heap is very small or usage ratio is unusual
          return totalJSHeapSize < 10 * 1024 * 1024 || // Less than 10MB
                 (usedJSHeapSize / totalJSHeapSize) > 0.9; // More than 90% usage
        }
        return false;
      },
      weight: 0.15
    });

    // Method 4: Screen Resolution Analysis
    this.detectionMethods.push({
      name: 'screen_resolution',
      detect: () => {
        const width = screen.width;
        const height = screen.height;
        
        // Common VM default resolutions
        const vmResolutions = [
          [800, 600], [1024, 768], [1280, 720], [1280, 800],
          [1366, 768], [1440, 900], [1600, 900], [1920, 1080]
        ];
        
        return vmResolutions.some(([w, h]) => width === w && height === h) &&
               screen.colorDepth === 24; // VMs often default to 24-bit color
      },
      weight: 0.1
    });

    // Method 5: Timing Analysis
    this.detectionMethods.push({
      name: 'timing_analysis',
      detect: async () => {
        // Measure performance of CPU-intensive operations
        const iterations = 100000;
        const start = performance.now();
        
        let result = 0;
        for (let i = 0; i < iterations; i++) {
          result += Math.random() * Math.sin(i);
        }
        
        const end = performance.now();
        const duration = end - start;
        
        // VMs typically have slower performance
        return duration > 50; // More than 50ms for this operation
      },
      weight: 0.2
    });

    // Method 6: WebGL Analysis
    this.detectionMethods.push({
      name: 'webgl_analysis',
      detect: () => {
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          
          if (!gl) return true; // No WebGL support is suspicious
          
          const renderer = gl.getParameter(gl.RENDERER);
          const vendor = gl.getParameter(gl.VENDOR);
          
          const vmIndicators = [
            'vmware', 'virtualbox', 'parallels', 'qemu', 'microsoft basic render',
            'llvmpipe', 'software rasterizer', 'mesa', 'gallium'
          ];
          
          const rendererLower = renderer.toLowerCase();
          const vendorLower = vendor.toLowerCase();
          
          return vmIndicators.some(indicator => 
            rendererLower.includes(indicator) || vendorLower.includes(indicator)
          );
        } catch (error) {
          return true; // WebGL error is suspicious
        }
      },
      weight: 0.3
    });

    // Method 7: Canvas Fingerprinting
    this.detectionMethods.push({
      name: 'canvas_fingerprinting',
      detect: () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) return true;
          
          // Draw a complex pattern
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillText('VM Detection Test 🔍', 2, 2);
          ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
          ctx.fillRect(100, 5, 80, 20);
          
          const imageData = canvas.toDataURL();
          
          // VMs often produce identical or very similar canvas fingerprints
          const commonVMFingerprints = [
            // Add known VM canvas fingerprints here
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACWCAYAAABkW7XS'
          ];
          
          return commonVMFingerprints.some(fingerprint => 
            imageData.startsWith(fingerprint.substring(0, 50))
          );
        } catch (error) {
          return true; // Canvas error is suspicious
        }
      },
      weight: 0.2
    });

    // Method 8: Audio Context Analysis
    this.detectionMethods.push({
      name: 'audio_context_analysis',
      detect: async () => {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const analyser = audioContext.createAnalyser();
          
          oscillator.connect(analyser);
          oscillator.frequency.value = 1000;
          oscillator.start();
          
          // VMs often have different audio processing characteristics
          const sampleRate = audioContext.sampleRate;
          
          oscillator.stop();
          audioContext.close();
          
          // Common VM audio sample rates
          const vmSampleRates = [22050, 44100, 48000];
          return !vmSampleRates.includes(sampleRate) || sampleRate === 22050;
        } catch (error) {
          return true; // Audio context error is suspicious
        }
      },
      weight: 0.15
    });

    // Method 9: Network Interface Analysis
    this.detectionMethods.push({
      name: 'network_interface_analysis',
      detect: async () => {
        try {
          // Use WebRTC to get network information
          const pc = new RTCPeerConnection({ iceServers: [] });
          const noop = () => {};
          
          pc.createDataChannel('');
          pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(noop);
          
          return new Promise<boolean>((resolve) => {
            let resolved = false;
            const timeout = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve(false);
              }
            }, 1000);
            
            pc.onicecandidate = (ice) => {
              if (resolved) return;
              
              if (ice && ice.candidate && ice.candidate.candidate) {
                const candidate = ice.candidate.candidate;
                
                // Check for VM network indicators
                const vmNetworkIndicators = [
                  '10.0.2.', '192.168.56.', '172.16.', '169.254.',
                  'vmnet', 'vboxnet', 'parallels'
                ];
                
                const isVMNetwork = vmNetworkIndicators.some(indicator => 
                  candidate.includes(indicator)
                );
                
                resolved = true;
                clearTimeout(timeout);
                pc.close();
                resolve(isVMNetwork);
              }
            };
          });
        } catch (error) {
          return false; // Network analysis failed, assume not VM
        }
      },
      weight: 0.25
    });

    // Method 10: Performance Timing Analysis
    this.detectionMethods.push({
      name: 'performance_timing_analysis',
      detect: () => {
        if (!performance.timing) return false;
        
        const timing = performance.timing;
        const navigationStart = timing.navigationStart;
        const loadEventEnd = timing.loadEventEnd;
        
        if (navigationStart && loadEventEnd) {
          const totalLoadTime = loadEventEnd - navigationStart;
          
          // VMs often have slower load times
          return totalLoadTime > 5000; // More than 5 seconds
        }
        
        return false;
      },
      weight: 0.1
    });
  }

  private createNegativeResult(): VMDetectionResult {
    return {
      isVirtualMachine: false,
      isEmulated: false,
      detectionMethods: [],
      confidence: 0,
      details: {
        error: 'Detection failed',
        timestamp: Date.now()
      }
    };
  }

  private emitEvent(event: VMDetectionEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in VM detection event handler:', error);
      }
    });
  }
}