/**
 * SystemIntegrityMonitor - System integrity monitoring for unauthorized software detection
 * 
 * Monitors for screen recording software, remote access tools, and other unauthorized
 * applications that could compromise quiz integrity.
 */

import type { IntegrityCheckResult, SecurityThreat } from './types';

interface SystemIntegrityConfig {
  monitorApplications: boolean;
  detectScreenRecording: boolean;
  detectRemoteAccess: boolean;
  monitorNetworkConnections: boolean;
}

interface IntegrityEvent {
  result: IntegrityCheckResult;
  threats?: SecurityThreat[];
}

type IntegrityEventHandler = (event: IntegrityEvent) => void;

export class SystemIntegrityMonitor {
  private config: SystemIntegrityConfig;
  private currentResult: IntegrityCheckResult;
  private eventHandlers: Set<IntegrityEventHandler> = new Set();
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;
  private isDestroyed = false;

  constructor(config: SystemIntegrityConfig) {
    this.config = config;
    this.currentResult = this.createInitialResult();
  }

  /**
   * Perform comprehensive system integrity check
   */
  async performCheck(): Promise<IntegrityCheckResult> {
    if (this.isDestroyed) return this.currentResult;

    const threats: SecurityThreat[] = [];

    try {
      // Check for unauthorized software
      if (this.config.monitorApplications) {
        const unauthorizedSoftware = await this.detectUnauthorizedSoftware();
        this.currentResult.unauthorizedSoftware = unauthorizedSoftware;
        
        if (unauthorizedSoftware.length > 0) {
          threats.push({
            id: `unauthorized_software_${Date.now()}`,
            type: 'unauthorized_software',
            severity: 'critical',
            message: `Unauthorized software detected: ${unauthorizedSoftware.join(', ')}`,
            details: { software: unauthorizedSoftware },
            timestamp: Date.now(),
            resolved: false
          });
        }
      }

      // Check for screen recording
      if (this.config.detectScreenRecording) {
        const screenRecordingDetected = await this.detectScreenRecording();
        this.currentResult.screenRecordingDetected = screenRecordingDetected;
        
        if (screenRecordingDetected) {
          threats.push({
            id: `screen_recording_${Date.now()}`,
            type: 'unauthorized_software',
            severity: 'critical',
            message: 'Screen recording software detected',
            details: { type: 'screen_recording' },
            timestamp: Date.now(),
            resolved: false
          });
        }
      }

      // Check for remote access
      if (this.config.detectRemoteAccess) {
        const remoteAccessDetected = await this.detectRemoteAccess();
        this.currentResult.remoteAccessDetected = remoteAccessDetected;
        
        if (remoteAccessDetected) {
          threats.push({
            id: `remote_access_${Date.now()}`,
            type: 'unauthorized_software',
            severity: 'critical',
            message: 'Remote access software detected',
            details: { type: 'remote_access' },
            timestamp: Date.now(),
            resolved: false
          });
        }
      }

      // Check for suspicious network activity
      if (this.config.monitorNetworkConnections) {
        const suspiciousNetworkActivity = await this.detectSuspiciousNetworkActivity();
        this.currentResult.suspiciousNetworkActivity = suspiciousNetworkActivity;
        
        if (suspiciousNetworkActivity) {
          threats.push({
            id: `suspicious_network_${Date.now()}`,
            type: 'integrity_violation',
            severity: 'high',
            message: 'Suspicious network activity detected',
            details: { type: 'network_activity' },
            timestamp: Date.now(),
            resolved: false
          });
        }
      }

      // Check for system modifications
      const systemModifications = await this.detectSystemModifications();
      this.currentResult.systemModifications = systemModifications;
      
      if (systemModifications.length > 0) {
        threats.push({
          id: `system_modifications_${Date.now()}`,
          type: 'integrity_violation',
          severity: 'high',
          message: `System modifications detected: ${systemModifications.join(', ')}`,
          details: { modifications: systemModifications },
          timestamp: Date.now(),
          resolved: false
        });
      }

      this.currentResult.lastChecked = Date.now();

      if (threats.length > 0) {
        this.emitEvent({ result: this.currentResult, threats });
      } else {
        this.emitEvent({ result: this.currentResult });
      }

      return this.currentResult;
    } catch (error) {
      const threat: SecurityThreat = {
        id: `integrity_check_error_${Date.now()}`,
        type: 'integrity_violation',
        severity: 'medium',
        message: `System integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error },
        timestamp: Date.now(),
        resolved: false
      };

      this.emitEvent({ result: this.currentResult, threats: [threat] });
      return this.currentResult;
    }
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring || this.isDestroyed) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.performCheck();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * Get current integrity status
   */
  getResult(): IntegrityCheckResult {
    return { ...this.currentResult };
  }

  /**
   * Add event handler
   */
  addEventListener(handler: IntegrityEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  removeEventListener(handler: IntegrityEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Destroy the monitor
   */
  destroy(): void {
    if (this.isDestroyed) return;

    this.stop();
    this.eventHandlers.clear();
    this.isDestroyed = true;
  }

  private createInitialResult(): IntegrityCheckResult {
    return {
      unauthorizedSoftware: [],
      screenRecordingDetected: false,
      remoteAccessDetected: false,
      suspiciousNetworkActivity: false,
      systemModifications: [],
      lastChecked: 0
    };
  }

  private async detectUnauthorizedSoftware(): Promise<string[]> {
    const unauthorizedSoftware: string[] = [];

    try {
      // Method 1: Check for known process indicators via window titles
      const suspiciousWindowTitles = [
        'OBS Studio', 'Bandicam', 'Camtasia', 'Fraps', 'XSplit',
        'TeamViewer', 'AnyDesk', 'Chrome Remote Desktop', 'VNC Viewer',
        'Wireshark', 'Fiddler', 'Charles Proxy', 'Burp Suite',
        'Cheat Engine', 'Process Hacker', 'Task Manager'
      ];

      // Check document title changes (some software modifies it)
      const originalTitle = document.title;
      for (const suspiciousTitle of suspiciousWindowTitles) {
        if (originalTitle.toLowerCase().includes(suspiciousTitle.toLowerCase())) {
          unauthorizedSoftware.push(`Window title indicates: ${suspiciousTitle}`);
        }
      }

      // Method 2: Check for injected scripts or modifications
      const scripts = Array.from(document.scripts);
      const suspiciousScripts = scripts.filter(script => {
        const src = script.src.toLowerCase();
        const content = script.innerHTML.toLowerCase();
        
        return src.includes('teamviewer') ||
               src.includes('anydesk') ||
               src.includes('vnc') ||
               content.includes('screen') && content.includes('record') ||
               content.includes('remote') && content.includes('control');
      });

      if (suspiciousScripts.length > 0) {
        unauthorizedSoftware.push(`${suspiciousScripts.length} suspicious scripts detected`);
      }

      // Method 3: Check for modified global objects that indicate software presence
      const globalIndicators = [
        '__TEAMVIEWER__',
        '__ANYDESK__',
        '__OBS__',
        '__BANDICAM__',
        '__REMOTE_DESKTOP__'
      ];

      for (const indicator of globalIndicators) {
        if ((window as any)[indicator]) {
          unauthorizedSoftware.push(`Global indicator found: ${indicator}`);
        }
      }

      // Method 4: Check for unusual clipboard behavior (some software monitors clipboard)
      if (navigator.clipboard) {
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText && clipboardText.includes('REMOTE_ACCESS_DETECTED')) {
            unauthorizedSoftware.push('Clipboard monitoring detected');
          }
        } catch (error) {
          // Clipboard access denied, which is normal
        }
      }

    } catch (error) {
      console.warn('Unauthorized software detection failed:', error);
    }

    return unauthorizedSoftware;
  }

  private async detectScreenRecording(): Promise<boolean> {
    try {
      // Method 1: Check for MediaRecorder API usage
      const originalMediaRecorder = window.MediaRecorder;
      let recordingDetected = false;
      
      // Override MediaRecorder to detect usage
      (window as any).MediaRecorder = class extends MediaRecorder {
        constructor(...args: any[]) {
          super(...args);
          recordingDetected = true;
        }
      };

      // Restore original after a short delay
      setTimeout(() => {
        window.MediaRecorder = originalMediaRecorder;
      }, 100);

      // Method 2: Check for screen capture streams
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        try {
          // This will fail if screen recording is already active
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
        } catch (error) {
          if (error instanceof Error && error.message.includes('already')) {
            recordingDetected = true;
          }
        }
      }

      // Method 3: Check for canvas recording indicators
      const canvases = Array.from(document.querySelectorAll('canvas'));
      for (const canvas of canvases) {
        try {
          const stream = (canvas as any).captureStream?.();
          if (stream && stream.active) {
            recordingDetected = true;
            break;
          }
        } catch (error) {
          // Canvas capture not available or failed
        }
      }

      // Method 4: Performance-based detection
      const start = performance.now();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Draw something that would be expensive to record
        for (let i = 0; i < 1000; i++) {
          ctx.fillRect(Math.random() * 100, Math.random() * 100, 1, 1);
        }
      }
      
      const end = performance.now();
      const renderTime = end - start;
      
      // If rendering is unusually slow, might indicate screen recording
      if (renderTime > 100) {
        recordingDetected = true;
      }

      return recordingDetected;
    } catch (error) {
      console.warn('Screen recording detection failed:', error);
      return false;
    }
  }

  private async detectRemoteAccess(): Promise<boolean> {
    try {
      // Method 1: Check for remote desktop indicators in user agent
      const userAgent = navigator.userAgent.toLowerCase();
      const remoteIndicators = ['teamviewer', 'anydesk', 'vnc', 'rdp', 'remote'];
      
      if (remoteIndicators.some(indicator => userAgent.includes(indicator))) {
        return true;
      }

      // Method 2: Check for unusual mouse/keyboard behavior patterns
      let suspiciousInputDetected = false;
      let lastMouseEvent = 0;
      let mouseEventCount = 0;

      const mouseHandler = () => {
        const now = Date.now();
        if (now - lastMouseEvent < 10) { // Very fast mouse events
          mouseEventCount++;
          if (mouseEventCount > 10) {
            suspiciousInputDetected = true;
          }
        } else {
          mouseEventCount = 0;
        }
        lastMouseEvent = now;
      };

      document.addEventListener('mousemove', mouseHandler);
      
      // Remove listener after a short test period
      setTimeout(() => {
        document.removeEventListener('mousemove', mouseHandler);
      }, 5000);

      // Method 3: Check for network latency patterns typical of remote access
      const networkLatency = await this.measureNetworkLatency();
      if (networkLatency > 200) { // High latency might indicate remote access
        return true;
      }

      // Method 4: Check for display scaling typical of remote access
      const devicePixelRatio = window.devicePixelRatio;
      const screenWidth = screen.width;
      const windowWidth = window.innerWidth;
      
      // Remote access often has unusual scaling
      if (devicePixelRatio !== 1 && (screenWidth / windowWidth) > 2) {
        return true;
      }

      return suspiciousInputDetected;
    } catch (error) {
      console.warn('Remote access detection failed:', error);
      return false;
    }
  }

  private async detectSuspiciousNetworkActivity(): Promise<boolean> {
    try {
      // Method 1: Monitor for unusual connection patterns
      const connectionInfo = (navigator as any).connection;
      if (connectionInfo) {
        // Check for VPN-like characteristics
        if (connectionInfo.effectiveType === 'slow-2g' && connectionInfo.downlink > 10) {
          return true; // Inconsistent connection characteristics
        }
      }

      // Method 2: Check for proxy usage
      const proxyDetected = await this.detectProxy();
      if (proxyDetected) {
        return true;
      }

      // Method 3: Monitor WebSocket connections
      const originalWebSocket = window.WebSocket;
      let suspiciousConnections = 0;
      
      (window as any).WebSocket = class extends WebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          
          const urlString = url.toString().toLowerCase();
          if (urlString.includes('remote') || 
              urlString.includes('proxy') || 
              urlString.includes('tunnel')) {
            suspiciousConnections++;
          }
        }
      };

      // Restore original WebSocket
      setTimeout(() => {
        window.WebSocket = originalWebSocket;
      }, 1000);

      return suspiciousConnections > 0;
    } catch (error) {
      console.warn('Network activity detection failed:', error);
      return false;
    }
  }

  private async detectSystemModifications(): Promise<string[]> {
    const modifications: string[] = [];

    try {
      // Check for modified browser APIs
      const originalAPIs = {
        fetch: window.fetch,
        XMLHttpRequest: window.XMLHttpRequest,
        WebSocket: window.WebSocket,
        localStorage: window.localStorage,
        sessionStorage: window.sessionStorage
      };

      for (const [apiName, originalAPI] of Object.entries(originalAPIs)) {
        const currentAPI = (window as any)[apiName];
        if (currentAPI !== originalAPI) {
          modifications.push(`${apiName} API modified`);
        }
      }

      // Check for injected CSS that might hide elements
      const stylesheets = Array.from(document.styleSheets);
      for (const stylesheet of stylesheets) {
        try {
          const rules = Array.from(stylesheet.cssRules || []);
          const suspiciousRules = rules.filter(rule => {
            const cssText = rule.cssText.toLowerCase();
            return cssText.includes('display: none') && 
                   (cssText.includes('devtools') || cssText.includes('inspector'));
          });
          
          if (suspiciousRules.length > 0) {
            modifications.push('Suspicious CSS rules detected');
          }
        } catch (error) {
          // Cross-origin stylesheet, skip
        }
      }

      // Check for modified prototype methods
      const prototypeMethods = [
        { obj: Array.prototype, method: 'push' },
        { obj: Object.prototype, method: 'toString' },
        { obj: Function.prototype, method: 'call' },
        { obj: Function.prototype, method: 'apply' }
      ];

      for (const { obj, method } of prototypeMethods) {
        const methodFunc = (obj as any)[method];
        if (methodFunc && !methodFunc.toString().includes('[native code]')) {
          modifications.push(`${obj.constructor.name}.prototype.${method} modified`);
        }
      }

    } catch (error) {
      console.warn('System modification detection failed:', error);
    }

    return modifications;
  }

  private async measureNetworkLatency(): Promise<number> {
    try {
      const start = performance.now();
      
      // Use a small image to measure latency
      const img = new Image();
      
      return new Promise<number>((resolve) => {
        const timeout = setTimeout(() => resolve(1000), 5000); // 5 second timeout
        
        img.onload = () => {
          clearTimeout(timeout);
          const latency = performance.now() - start;
          resolve(latency);
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          resolve(1000); // Assume high latency on error
        };
        
        // Use a tiny image for latency test
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      });
    } catch (error) {
      return 1000; // Return high latency on error
    }
  }

  private async detectProxy(): Promise<boolean> {
    try {
      // Method 1: Check timezone vs expected location
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const language = navigator.language;
      
      // Simple heuristic: if timezone doesn't match language region
      if (language.startsWith('en-US') && !timezone.includes('America')) {
        return true;
      }

      // Method 2: Check for WebRTC IP leakage
      return new Promise<boolean>((resolve) => {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        let resolved = false;
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        }, 3000);
        
        pc.onicecandidate = (ice) => {
          if (resolved || !ice || !ice.candidate) return;
          
          const candidate = ice.candidate.candidate;
          const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
          
          if (ipMatch) {
            const ip = ipMatch[1];
            // Check for private IP ranges (might indicate proxy)
            const isPrivate = ip.startsWith('10.') || 
                            ip.startsWith('192.168.') || 
                            ip.startsWith('172.');
            
            resolved = true;
            clearTimeout(timeout);
            pc.close();
            resolve(!isPrivate); // Proxy likely if no private IP found
          }
        };
        
        pc.createDataChannel('');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
      });
    } catch (error) {
      return false;
    }
  }

  private emitEvent(event: IntegrityEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in integrity event handler:', error);
      }
    });
  }
}