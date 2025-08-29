/**
 * BrowserSecurityDetector - Comprehensive browser security detection and blocking
 * 
 * Detects and blocks developer tools, extensions, browser modifications, and other
 * security vulnerabilities that could compromise quiz integrity.
 */

import type { BrowserSecurityStatus, SecurityThreat } from './types';

interface BrowserSecurityConfig {
  blockDeveloperTools: boolean;
  blockExtensions: boolean;
  blockModifications: boolean;
  detectVirtualization: boolean;
}

interface BrowserSecurityEvent {
  status: BrowserSecurityStatus;
  threats?: SecurityThreat[];
}

type BrowserSecurityEventHandler = (event: BrowserSecurityEvent) => void;

export class BrowserSecurityDetector {
  private config: BrowserSecurityConfig;
  private currentStatus: BrowserSecurityStatus;
  private eventHandlers: Set<BrowserSecurityEventHandler> = new Set();
  private monitoringInterval?: NodeJS.Timeout;
  private devToolsCheckInterval?: NodeJS.Timeout;
  private isMonitoring = false;
  private isDestroyed = false;

  // DevTools detection state
  private devToolsOpen = false;
  private devToolsCheckMethods: (() => boolean)[] = [];

  constructor(config: BrowserSecurityConfig) {
    this.config = config;
    this.currentStatus = this.createInitialStatus();
    this.setupDevToolsDetection();
    this.setupSecurityListeners();
  }

  /**
   * Perform comprehensive browser security check
   */
  async performCheck(): Promise<BrowserSecurityStatus> {
    if (this.isDestroyed) return this.currentStatus;

    const threats: SecurityThreat[] = [];

    try {
      // Check for developer tools
      if (this.config.blockDeveloperTools) {
        const devToolsDetected = this.checkDevTools();
        this.currentStatus.developerToolsOpen = devToolsDetected;
        
        if (devToolsDetected) {
          threats.push({
            id: `devtools_${Date.now()}`,
            type: 'browser_security',
            severity: 'critical',
            message: 'Developer tools detected - quiz access blocked',
            details: { 
              detectionMethod: 'multiple_methods',
              blocked: true 
            },
            timestamp: Date.now(),
            resolved: false
          });
        }
      }

      // Check for browser extensions
      if (this.config.blockExtensions) {
        const extensions = await this.detectExtensions();
        this.currentStatus.extensionsDetected = extensions;
        
        if (extensions.length > 0) {
          threats.push({
            id: `extensions_${Date.now()}`,
            type: 'browser_security',
            severity: 'high',
            message: `Browser extensions detected: ${extensions.join(', ')}`,
            details: { 
              extensions,
              blocked: true 
            },
            timestamp: Date.now(),
            resolved: false
          });
        }
      }

      // Check for browser modifications
      if (this.config.blockModifications) {
        const modifications = this.detectBrowserModifications();
        this.currentStatus.browserModifications = modifications;
        
        if (modifications.length > 0) {
          threats.push({
            id: `modifications_${Date.now()}`,
            type: 'browser_security',
            severity: 'high',
            message: `Browser modifications detected: ${modifications.join(', ')}`,
            details: { 
              modifications,
              blocked: true 
            },
            timestamp: Date.now(),
            resolved: false
          });
        }
      }

      // Update security violations
      this.currentStatus.securityViolations = threats.map(t => t.message);
      this.currentStatus.lastChecked = Date.now();

      if (threats.length > 0) {
        this.emitEvent({ status: this.currentStatus, threats });
      } else {
        this.emitEvent({ status: this.currentStatus });
      }

      return this.currentStatus;
    } catch (error) {
      const threat: SecurityThreat = {
        id: `security_check_error_${Date.now()}`,
        type: 'browser_security',
        severity: 'medium',
        message: `Browser security check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error },
        timestamp: Date.now(),
        resolved: false
      };

      this.emitEvent({ status: this.currentStatus, threats: [threat] });
      return this.currentStatus;
    }
  }

  /**
   * Start continuous browser security monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring || this.isDestroyed) return;

    this.isMonitoring = true;

    // Start developer tools monitoring
    if (this.config.blockDeveloperTools) {
      this.devToolsCheckInterval = setInterval(() => {
        this.checkDevTools();
      }, 500); // Check every 500ms for responsive detection
    }

    // Start general security monitoring
    this.monitoringInterval = setInterval(() => {
      this.performCheck();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.devToolsCheckInterval) {
      clearInterval(this.devToolsCheckInterval);
      this.devToolsCheckInterval = undefined;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;
  }

  /**
   * Get current browser security status
   */
  getStatus(): BrowserSecurityStatus {
    return { ...this.currentStatus };
  }

  /**
   * Add event handler
   */
  addEventListener(handler: BrowserSecurityEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  removeEventListener(handler: BrowserSecurityEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Destroy the detector and cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) return;

    this.stop();
    this.eventHandlers.clear();
    this.isDestroyed = true;
  }

  private createInitialStatus(): BrowserSecurityStatus {
    return {
      developerToolsOpen: false,
      extensionsDetected: [],
      browserModifications: [],
      securityViolations: [],
      lastChecked: 0
    };
  }

  private setupDevToolsDetection(): void {
    // Method 1: Console detection
    this.devToolsCheckMethods.push(() => {
      const threshold = 160;
      return window.outerHeight - window.innerHeight > threshold ||
             window.outerWidth - window.innerWidth > threshold;
    });

    // Method 2: DevTools console.clear override detection
    this.devToolsCheckMethods.push(() => {
      let devtools = false;
      const originalClear = console.clear;
      console.clear = function() {
        devtools = true;
        return originalClear.apply(console, arguments as any);
      };
      
      // Trigger console.clear to test
      setTimeout(() => console.clear(), 1);
      
      return devtools;
    });

    // Method 3: Debugger statement timing
    this.devToolsCheckMethods.push(() => {
      const start = performance.now();
      debugger; // This will pause if devtools is open
      const end = performance.now();
      return end - start > 100; // If it took more than 100ms, devtools likely open
    });

    // Method 4: Function toString detection
    this.devToolsCheckMethods.push(() => {
      const func = () => {};
      const funcString = func.toString();
      return funcString.includes('native code') && funcString.length < 100;
    });

    // Method 5: RegExp toString detection
    this.devToolsCheckMethods.push(() => {
      let devtools = false;
      const element = new Image();
      Object.defineProperty(element, 'id', {
        get: function() {
          devtools = true;
          return 'devtools-detected';
        }
      });
      console.log(element);
      return devtools;
    });
  }

  private checkDevTools(): boolean {
    if (this.isDestroyed) return false;

    let detected = false;
    
    // Run all detection methods
    for (const method of this.devToolsCheckMethods) {
      try {
        if (method()) {
          detected = true;
          break;
        }
      } catch (error) {
        // Method failed, continue with others
        continue;
      }
    }

    // Additional checks
    if (!detected) {
      // Check for common devtools indicators
      detected = this.checkDevToolsIndicators();
    }

    if (detected !== this.devToolsOpen) {
      this.devToolsOpen = detected;
      this.currentStatus.developerToolsOpen = detected;
      
      if (detected) {
        const threat: SecurityThreat = {
          id: `devtools_opened_${Date.now()}`,
          type: 'browser_security',
          severity: 'critical',
          message: 'Developer tools opened during quiz - session terminated',
          details: { 
            detectionTime: Date.now(),
            blocked: true 
          },
          timestamp: Date.now(),
          resolved: false
        };
        
        this.emitEvent({ status: this.currentStatus, threats: [threat] });
      }
    }

    return detected;
  }

  private checkDevToolsIndicators(): boolean {
    // Check window dimensions
    const heightThreshold = 160;
    const widthThreshold = 160;
    
    if (window.outerHeight - window.innerHeight > heightThreshold ||
        window.outerWidth - window.innerWidth > widthThreshold) {
      return true;
    }

    // Check for Firebug
    if ((window as any).console && (window as any).console.firebug) {
      return true;
    }

    // Check for Chrome DevTools
    if ((window as any).chrome && (window as any).chrome.runtime) {
      return true;
    }

    return false;
  }

  private async detectExtensions(): Promise<string[]> {
    const extensions: string[] = [];

    try {
      // Method 1: Check for common extension indicators
      const commonExtensions = [
        'chrome-extension://',
        'moz-extension://',
        'safari-extension://',
        'ms-browser-extension://'
      ];

      // Check if any extension resources are loaded
      const scripts = Array.from(document.scripts);
      const links = Array.from(document.querySelectorAll('link'));
      
      for (const script of scripts) {
        for (const ext of commonExtensions) {
          if (script.src && script.src.includes(ext)) {
            extensions.push(`Extension script detected: ${script.src}`);
          }
        }
      }

      for (const link of links) {
        for (const ext of commonExtensions) {
          if (link.href && link.href.includes(ext)) {
            extensions.push(`Extension resource detected: ${link.href}`);
          }
        }
      }

      // Method 2: Check for modified global objects
      const originalFetch = window.fetch;
      const originalXMLHttpRequest = window.XMLHttpRequest;
      
      if (window.fetch !== originalFetch) {
        extensions.push('Fetch API modified by extension');
      }
      
      if (window.XMLHttpRequest !== originalXMLHttpRequest) {
        extensions.push('XMLHttpRequest modified by extension');
      }

      // Method 3: Check for common extension global variables
      const extensionIndicators = [
        '__REACT_DEVTOOLS_GLOBAL_HOOK__',
        '__VUE_DEVTOOLS_GLOBAL_HOOK__',
        '__REDUX_DEVTOOLS_EXTENSION__',
        'webpackJsonp'
      ];

      for (const indicator of extensionIndicators) {
        if ((window as any)[indicator]) {
          extensions.push(`Developer extension detected: ${indicator}`);
        }
      }

    } catch (error) {
      console.warn('Extension detection failed:', error);
    }

    return extensions;
  }

  private detectBrowserModifications(): string[] {
    const modifications: string[] = [];

    try {
      // Check for modified console methods
      const consoleMethods = ['log', 'warn', 'error', 'info', 'debug'];
      for (const method of consoleMethods) {
        const consoleMethod = (console as any)[method];
        if (consoleMethod && consoleMethod.toString().includes('[native code]') === false) {
          modifications.push(`Console.${method} modified`);
        }
      }

      // Check for modified DOM methods
      const originalCreateElement = document.createElement;
      if (document.createElement !== originalCreateElement) {
        modifications.push('document.createElement modified');
      }

      const originalQuerySelector = document.querySelector;
      if (document.querySelector !== originalQuerySelector) {
        modifications.push('document.querySelector modified');
      }

      // Check for modified window methods
      const originalAlert = window.alert;
      if (window.alert !== originalAlert) {
        modifications.push('window.alert modified');
      }

      const originalConfirm = window.confirm;
      if (window.confirm !== originalConfirm) {
        modifications.push('window.confirm modified');
      }

      // Check for injected scripts
      const scripts = Array.from(document.scripts);
      const suspiciousScripts = scripts.filter(script => 
        !script.src || 
        script.src.includes('chrome-extension://') ||
        script.src.includes('moz-extension://') ||
        script.innerHTML.includes('eval(') ||
        script.innerHTML.includes('Function(')
      );

      if (suspiciousScripts.length > 0) {
        modifications.push(`${suspiciousScripts.length} suspicious scripts detected`);
      }

    } catch (error) {
      console.warn('Browser modification detection failed:', error);
    }

    return modifications;
  }

  private setupSecurityListeners(): void {
    // Listen for context menu (right-click) attempts
    document.addEventListener('contextmenu', (e) => {
      if (this.config.blockDeveloperTools) {
        e.preventDefault();
        const threat: SecurityThreat = {
          id: `contextmenu_${Date.now()}`,
          type: 'browser_security',
          severity: 'medium',
          message: 'Context menu access attempted',
          details: { blocked: true },
          timestamp: Date.now(),
          resolved: false
        };
        this.emitEvent({ status: this.currentStatus, threats: [threat] });
      }
    });

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (this.config.blockDeveloperTools) {
        // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, etc.
        const blockedKeys = [
          { key: 'F12' },
          { key: 'I', ctrlKey: true, shiftKey: true },
          { key: 'J', ctrlKey: true, shiftKey: true },
          { key: 'U', ctrlKey: true },
          { key: 'S', ctrlKey: true },
          { key: 'A', ctrlKey: true },
          { key: 'P', ctrlKey: true },
          { key: 'F', ctrlKey: true }
        ];

        for (const blocked of blockedKeys) {
          if (e.key === blocked.key &&
              (!blocked.ctrlKey || e.ctrlKey) &&
              (!blocked.shiftKey || e.shiftKey)) {
            e.preventDefault();
            e.stopPropagation();
            
            const threat: SecurityThreat = {
              id: `keyboard_shortcut_${Date.now()}`,
              type: 'browser_security',
              severity: 'medium',
              message: `Blocked keyboard shortcut: ${e.key}`,
              details: { 
                key: e.key,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                blocked: true 
              },
              timestamp: Date.now(),
              resolved: false
            };
            this.emitEvent({ status: this.currentStatus, threats: [threat] });
            return;
          }
        }
      }
    });

    // Listen for window focus changes
    window.addEventListener('blur', () => {
      const threat: SecurityThreat = {
        id: `window_blur_${Date.now()}`,
        type: 'browser_security',
        severity: 'medium',
        message: 'Window lost focus during quiz',
        details: { timestamp: Date.now() },
        timestamp: Date.now(),
        resolved: false
      };
      this.emitEvent({ status: this.currentStatus, threats: [threat] });
    });

    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        const threat: SecurityThreat = {
          id: `tab_hidden_${Date.now()}`,
          type: 'browser_security',
          severity: 'high',
          message: 'Tab became hidden during quiz',
          details: { timestamp: Date.now() },
          timestamp: Date.now(),
          resolved: false
        };
        this.emitEvent({ status: this.currentStatus, threats: [threat] });
      }
    });
  }

  private emitEvent(event: BrowserSecurityEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in browser security event handler:', error);
      }
    });
  }
}