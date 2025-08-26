/**
 * IntegrityEnforcer - Academic integrity enforcement system
 * 
 * Implements copy/paste prevention, right-click blocking, developer tools detection,
 * fullscreen enforcement, and page visibility monitoring with flag generation.
 */

import { IntegrityViolation } from './types';
import { FlagEvent } from '../proctoring/types';

export interface IntegrityConfig {
  preventCopyPaste: boolean;
  blockRightClick: boolean;
  blockDevTools: boolean;
  enforceFullscreen: boolean;
  monitorPageVisibility: boolean;
  flagOnViolation: boolean;
  gracePeriodMs: number;
}

export interface IntegrityCallbacks {
  onViolation?: (violation: IntegrityViolation) => void;
  onFlag?: (flag: FlagEvent) => void;
  onFullscreenExit?: () => void;
  onTabBlur?: () => void;
}

export class IntegrityEnforcer {
  private config: IntegrityConfig;
  private callbacks: IntegrityCallbacks;
  private isActive = false;
  private violations: IntegrityViolation[] = [];
  private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];
  private fullscreenCheckInterval: NodeJS.Timeout | null = null;
  private gracePeriodTimeout: NodeJS.Timeout | null = null;
  private isInGracePeriod = false;

  constructor(config: IntegrityConfig, callbacks: IntegrityCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
  }

  /**
   * Start integrity enforcement
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.violations = [];

    // Set up all enforcement mechanisms
    if (this.config.preventCopyPaste) {
      this.setupCopyPasteBlocking();
    }

    if (this.config.blockRightClick) {
      this.setupRightClickBlocking();
    }

    if (this.config.blockDevTools) {
      this.setupDevToolsBlocking();
    }

    if (this.config.enforceFullscreen) {
      this.setupFullscreenEnforcement();
    }

    if (this.config.monitorPageVisibility) {
      this.setupPageVisibilityMonitoring();
    }

    // Start grace period
    this.startGracePeriod();
  }

  /**
   * Stop integrity enforcement
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Remove all event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Clear intervals and timeouts
    if (this.fullscreenCheckInterval) {
      clearInterval(this.fullscreenCheckInterval);
      this.fullscreenCheckInterval = null;
    }

    if (this.gracePeriodTimeout) {
      clearTimeout(this.gracePeriodTimeout);
      this.gracePeriodTimeout = null;
    }

    this.isInGracePeriod = false;
  }

  /**
   * Get all violations
   */
  getViolations(): IntegrityViolation[] {
    return [...this.violations];
  }

  /**
   * Clear violations
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Check if currently in fullscreen
   */
  isFullscreen(): boolean {
    return !!(
      document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
      (document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement ||
      (document as Document & { msFullscreenElement?: Element }).msFullscreenElement
    );
  }

  /**
   * Request fullscreen mode
   */
  async requestFullscreen(): Promise<boolean> {
    try {
      const element = document.documentElement;
      
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
        await (element as HTMLElement & { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
      } else if ((element as HTMLElement & { mozRequestFullScreen?: () => Promise<void> }).mozRequestFullScreen) {
        await (element as HTMLElement & { mozRequestFullScreen: () => Promise<void> }).mozRequestFullScreen();
      } else if ((element as HTMLElement & { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen) {
        await (element as HTMLElement & { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen();
      } else {
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to request fullscreen:', error);
      return false;
    }
  }

  /**
   * Set up copy/paste blocking
   */
  private setupCopyPasteBlocking(): void {
    const preventCopyPaste = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (!this.isInGracePeriod) {
        this.recordViolation('copy-paste', {
          action: event.type,
          target: (event.target as Element)?.tagName || 'unknown'
        });
      }
    };

    const preventKeyboardShortcuts = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      // Block common copy/paste shortcuts
      if (keyboardEvent.ctrlKey || keyboardEvent.metaKey) {
        const blockedKeys = ['c', 'v', 'x', 'a', 's', 'z', 'y'];
        if (blockedKeys.includes(keyboardEvent.key.toLowerCase())) {
          event.preventDefault();
          event.stopPropagation();
          
          if (!this.isInGracePeriod) {
            this.recordViolation('copy-paste', {
              action: 'keyboard-shortcut',
              key: keyboardEvent.key,
              ctrlKey: keyboardEvent.ctrlKey,
              metaKey: keyboardEvent.metaKey
            });
          }
        }
      }
    };

    this.addEventListener(document, 'copy', preventCopyPaste);
    this.addEventListener(document, 'cut', preventCopyPaste);
    this.addEventListener(document, 'paste', preventCopyPaste);
    this.addEventListener(document, 'keydown', preventKeyboardShortcuts);
  }

  /**
   * Set up right-click blocking
   */
  private setupRightClickBlocking(): void {
    const preventRightClick = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      if (mouseEvent.button === 2) { // Right click
        event.preventDefault();
        event.stopPropagation();
        
        if (!this.isInGracePeriod) {
          this.recordViolation('right-click', {
            x: mouseEvent.clientX,
            y: mouseEvent.clientY,
            target: (event.target as Element)?.tagName || 'unknown'
          });
        }
      }
    };

    const preventContextMenu = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    this.addEventListener(document, 'mousedown', preventRightClick);
    this.addEventListener(document, 'contextmenu', preventContextMenu);
  }

  /**
   * Set up developer tools blocking
   */
  private setupDevToolsBlocking(): void {
    const preventDevToolsShortcuts = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, etc.
      const isDevToolsShortcut = 
        keyboardEvent.key === 'F12' ||
        (keyboardEvent.ctrlKey && keyboardEvent.shiftKey && ['I', 'J', 'C'].includes(keyboardEvent.key.toUpperCase())) ||
        (keyboardEvent.ctrlKey && keyboardEvent.key.toLowerCase() === 'u') ||
        (keyboardEvent.ctrlKey && keyboardEvent.shiftKey && keyboardEvent.key === 'Delete') ||
        (keyboardEvent.key === 'F7'); // IE dev tools

      if (isDevToolsShortcut) {
        event.preventDefault();
        event.stopPropagation();
        
        if (!this.isInGracePeriod) {
          this.recordViolation('dev-tools', {
            key: keyboardEvent.key,
            ctrlKey: keyboardEvent.ctrlKey,
            shiftKey: keyboardEvent.shiftKey,
            altKey: keyboardEvent.altKey
          });
        }
      }
    };

    // Monitor for dev tools opening (heuristic approach)
    let devToolsOpen = false;
    const checkDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        if (!devToolsOpen && !this.isInGracePeriod) {
          devToolsOpen = true;
          this.recordViolation('dev-tools', {
            method: 'size-detection',
            outerWidth: window.outerWidth,
            innerWidth: window.innerWidth,
            outerHeight: window.outerHeight,
            innerHeight: window.innerHeight
          });
        }
      } else {
        devToolsOpen = false;
      }
    };

    this.addEventListener(document, 'keydown', preventDevToolsShortcuts);
    this.addEventListener(window, 'resize', checkDevTools);
    
    // Check periodically
    const devToolsInterval = setInterval(checkDevTools, 1000);
    
    // Store interval for cleanup
    this.eventListeners.push({
      element: window as Window & EventTarget,
      event: 'cleanup',
      handler: () => clearInterval(devToolsInterval)
    });
  }

  /**
   * Set up fullscreen enforcement
   */
  private setupFullscreenEnforcement(): void {
    const handleFullscreenChange = () => {
      if (!this.isFullscreen() && this.isActive && !this.isInGracePeriod) {
        this.recordViolation('fullscreen-exit', {
          timestamp: Date.now()
        });
        
        if (this.callbacks.onFullscreenExit) {
          this.callbacks.onFullscreenExit();
        }
      }
    };

    // Listen for fullscreen change events
    this.addEventListener(document, 'fullscreenchange', handleFullscreenChange);
    this.addEventListener(document, 'webkitfullscreenchange', handleFullscreenChange);
    this.addEventListener(document, 'mozfullscreenchange', handleFullscreenChange);
    this.addEventListener(document, 'MSFullscreenChange', handleFullscreenChange);

    // Periodic fullscreen check
    this.fullscreenCheckInterval = setInterval(() => {
      if (!this.isFullscreen() && this.isActive && !this.isInGracePeriod) {
        this.recordViolation('fullscreen-exit', {
          method: 'periodic-check',
          timestamp: Date.now()
        });
        
        if (this.callbacks.onFullscreenExit) {
          this.callbacks.onFullscreenExit();
        }
      }
    }, 2000);
  }

  /**
   * Set up page visibility monitoring
   */
  private setupPageVisibilityMonitoring(): void {
    const handleVisibilityChange = () => {
      if (document.hidden && this.isActive && !this.isInGracePeriod) {
        this.recordViolation('tab-blur', {
          visibilityState: document.visibilityState,
          timestamp: Date.now()
        });
        
        if (this.callbacks.onTabBlur) {
          this.callbacks.onTabBlur();
        }
      }
    };

    const handleWindowBlur = () => {
      if (this.isActive && !this.isInGracePeriod) {
        this.recordViolation('tab-blur', {
          type: 'window-blur',
          timestamp: Date.now()
        });
        
        if (this.callbacks.onTabBlur) {
          this.callbacks.onTabBlur();
        }
      }
    };

    this.addEventListener(document, 'visibilitychange', handleVisibilityChange);
    this.addEventListener(window, 'blur', handleWindowBlur);
  }

  /**
   * Start grace period to avoid false positives during setup
   */
  private startGracePeriod(): void {
    this.isInGracePeriod = true;
    
    this.gracePeriodTimeout = setTimeout(() => {
      this.isInGracePeriod = false;
    }, this.config.gracePeriodMs);
  }

  /**
   * Record an integrity violation
   */
  private recordViolation(type: IntegrityViolation['type'], details: Record<string, unknown>): void {
    const violation: IntegrityViolation = {
      type,
      timestamp: Date.now(),
      details
    };

    this.violations.push(violation);

    // Notify callback
    if (this.callbacks.onViolation) {
      this.callbacks.onViolation(violation);
    }

    // Generate flag if configured
    if (this.config.flagOnViolation && this.callbacks.onFlag) {
      const flag: FlagEvent = {
        id: `integrity_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        timestamp: violation.timestamp,
        type: this.mapViolationToFlagType(type),
        severity: this.getViolationSeverity(type),
        confidence: 1.0, // High confidence for integrity violations
        details: {
          violationType: type,
          ...details
        }
      };

      this.callbacks.onFlag(flag);
    }
  }

  /**
   * Map violation type to flag type
   */
  private mapViolationToFlagType(violationType: IntegrityViolation['type']): FlagEvent['type'] {
    switch (violationType) {
      case 'copy-paste':
      case 'right-click':
      case 'dev-tools':
        return 'INTEGRITY_VIOLATION';
      case 'fullscreen-exit':
        return 'FULLSCREEN_EXIT';
      case 'tab-blur':
        return 'TAB_BLUR';
      default:
        return 'INTEGRITY_VIOLATION';
    }
  }

  /**
   * Get violation severity
   */
  private getViolationSeverity(violationType: IntegrityViolation['type']): 'soft' | 'hard' {
    switch (violationType) {
      case 'copy-paste':
      case 'dev-tools':
      case 'fullscreen-exit':
        return 'hard';
      case 'right-click':
      case 'tab-blur':
        return 'soft';
      default:
        return 'soft';
    }
  }

  /**
   * Add event listener and track for cleanup
   */
  private addEventListener(element: EventTarget, event: string, handler: EventListener): void {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.violations = [];
    this.callbacks = {};
  }
}