/**
 * Accessibility utilities for focus management and screen reader support
 */

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  ScreenReaderAnnouncer.announce(message, priority);
}

/**
 * Set focus to an element
 */
export function setFocusToElement(element: HTMLElement): void {
  element.focus();
}

/**
 * Create a focus trap
 */
export function trapFocus(container: HTMLElement): () => void {
  return FocusManager.createFocusTrap(container);
}

/**
 * Get accessible name of an element
 */
export function getAccessibleName(element: HTMLElement): string {
  // Check aria-label first
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  // Check aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) return labelElement.textContent || '';
  }
  
  // Check associated label
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
    const id = element.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent || '';
    }
  }
  
  // Fall back to text content
  return element.textContent || '';
}

/**
 * Check color contrast
 */
export function checkColorContrast(foreground: [number, number, number], background: [number, number, number]): {
  ratio: number;
  meetsAA: boolean;
  meetsAAA: boolean;
} {
  const ratio = ColorContrast.getContrastRatio(foreground, background);
  return {
    ratio,
    meetsAA: ColorContrast.meetsWCAGAA(foreground, background),
    meetsAAA: ColorContrast.meetsWCAGAAA(foreground, background)
  };
}

/**
 * Validate keyboard navigation
 */
export function validateKeyboardNavigation(container: HTMLElement): {
  focusableElements: number;
  hasTabIndex: boolean;
  canNavigate: boolean;
} {
  const focusableElements = FocusManager.getFocusableElements(container);
  const hasTabIndex = focusableElements.some(el => el.hasAttribute('tabindex'));
  
  return {
    focusableElements: focusableElements.length,
    hasTabIndex,
    canNavigate: focusableElements.length > 0
  };
}

/**
 * Create ARIA live region
 */
export function createAriaLiveRegion(id: string, priority: 'polite' | 'assertive' = 'polite'): HTMLElement {
  return ScreenReaderAnnouncer.getLiveRegion(id, priority);
}

/**
 * Manage focus order
 */
export function manageFocusOrder(elements: HTMLElement[]): void {
  elements.forEach((element, index) => {
    element.setAttribute('tabindex', index === 0 ? '0' : '-1');
  });
}

/**
 * Add skip link
 */
export function addSkipLink(targetId: string, text: string = 'Skip to main content'): HTMLElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = text;
  skipLink.className = 'skip-link';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 6px;
    background: #000;
    color: #fff;
    padding: 8px;
    text-decoration: none;
    z-index: 1000;
  `;
  
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '6px';
  });
  
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });
  
  document.body.insertBefore(skipLink, document.body.firstChild);
  return skipLink;
}

/**
 * Focus management utilities
 */
export class FocusManager {
  private static focusStack: HTMLElement[] = [];

  /**
   * Store current focus and move to new element
   */
  static pushFocus(newElement: HTMLElement): void {
    const currentFocus = document.activeElement as HTMLElement;
    if (currentFocus && currentFocus !== document.body) {
      this.focusStack.push(currentFocus);
    }
    newElement.focus();
  }

  /**
   * Restore previous focus
   */
  static popFocus(): void {
    const previousFocus = this.focusStack.pop();
    if (previousFocus) {
      previousFocus.focus();
    }
  }

  /**
   * Get all focusable elements within a container
   */
  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors));
  }

  /**
   * Create a focus trap within a container
   */
  static createFocusTrap(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container);
    
    if (focusableElements.length === 0) {
      return () => {};
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);

    // Focus first element
    firstElement.focus();

    // Return cleanup function
    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }
}

/**
 * Screen reader announcement utilities
 */
export class ScreenReaderAnnouncer {
  private static liveRegions: Map<string, HTMLElement> = new Map();

  /**
   * Create or get a live region for announcements
   */
  static getLiveRegion(id: string, priority: 'polite' | 'assertive' = 'polite'): HTMLElement {
    let region = this.liveRegions.get(id);
    
    if (!region) {
      region = document.createElement('div');
      region.id = id;
      region.className = 'sr-only';
      region.setAttribute('aria-live', priority);
      region.setAttribute('aria-atomic', 'true');
      document.body.appendChild(region);
      this.liveRegions.set(id, region);
    }

    return region;
  }

  /**
   * Announce a message to screen readers
   */
  static announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const region = this.getLiveRegion('announcements', priority);
    
    // Clear and set new message
    region.textContent = '';
    setTimeout(() => {
      region.textContent = message;
    }, 10);
  }

  /**
   * Announce quiz-specific messages
   */
  static announceQuizEvent(message: string): void {
    const region = this.getLiveRegion('quiz-announcements', 'polite');
    region.textContent = message;
  }

  /**
   * Announce alerts with high priority
   */
  static announceAlert(message: string): void {
    const region = this.getLiveRegion('alert-announcements', 'assertive');
    region.textContent = message;
  }
}

/**
 * Color contrast utilities
 */
export class ColorContrast {
  /**
   * Calculate relative luminance of a color
   */
  static getRelativeLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  static getContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
    const l1 = this.getRelativeLuminance(...color1);
    const l2 = this.getRelativeLuminance(...color2);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Check if color combination meets WCAG AA standards
   */
  static meetsWCAGAA(foreground: [number, number, number], background: [number, number, number]): boolean {
    const ratio = this.getContrastRatio(foreground, background);
    return ratio >= 4.5; // WCAG AA standard for normal text
  }

  /**
   * Check if color combination meets WCAG AAA standards
   */
  static meetsWCAGAAA(foreground: [number, number, number], background: [number, number, number]): boolean {
    const ratio = this.getContrastRatio(foreground, background);
    return ratio >= 7; // WCAG AAA standard for normal text
  }
}

/**
 * Keyboard navigation utilities
 */
export class KeyboardNavigation {
  /**
   * Handle arrow key navigation within a container
   */
  static handleArrowNavigation(
    event: KeyboardEvent,
    container: HTMLElement,
    options: {
      horizontal?: boolean;
      vertical?: boolean;
      wrap?: boolean;
    } = {}
  ): boolean {
    const { horizontal = true, vertical = true, wrap = true } = options;
    
    const focusableElements = FocusManager.getFocusableElements(container);
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    
    if (currentIndex === -1) return false;

    let nextIndex = currentIndex;
    
    switch (event.key) {
      case 'ArrowRight':
        if (horizontal) {
          nextIndex = currentIndex + 1;
          if (nextIndex >= focusableElements.length && wrap) {
            nextIndex = 0;
          }
        }
        break;
      case 'ArrowLeft':
        if (horizontal) {
          nextIndex = currentIndex - 1;
          if (nextIndex < 0 && wrap) {
            nextIndex = focusableElements.length - 1;
          }
        }
        break;
      case 'ArrowDown':
        if (vertical) {
          nextIndex = currentIndex + 1;
          if (nextIndex >= focusableElements.length && wrap) {
            nextIndex = 0;
          }
        }
        break;
      case 'ArrowUp':
        if (vertical) {
          nextIndex = currentIndex - 1;
          if (nextIndex < 0 && wrap) {
            nextIndex = focusableElements.length - 1;
          }
        }
        break;
      default:
        return false;
    }

    if (nextIndex !== currentIndex && nextIndex >= 0 && nextIndex < focusableElements.length) {
      event.preventDefault();
      focusableElements[nextIndex].focus();
      return true;
    }

    return false;
  }

  /**
   * Handle Home/End key navigation
   */
  static handleHomeEndNavigation(event: KeyboardEvent, container: HTMLElement): boolean {
    const focusableElements = FocusManager.getFocusableElements(container);
    
    if (focusableElements.length === 0) return false;

    switch (event.key) {
      case 'Home':
        event.preventDefault();
        focusableElements[0].focus();
        return true;
      case 'End':
        event.preventDefault();
        focusableElements[focusableElements.length - 1].focus();
        return true;
      default:
        return false;
    }
  }
}

/**
 * ARIA utilities
 */
export class ARIAUtils {
  /**
   * Set ARIA attributes for a progress indicator
   */
  static setProgressAttributes(
    element: HTMLElement,
    current: number,
    max: number,
    label?: string
  ): void {
    element.setAttribute('role', 'progressbar');
    element.setAttribute('aria-valuenow', current.toString());
    element.setAttribute('aria-valuemax', max.toString());
    element.setAttribute('aria-valuemin', '0');
    
    if (label) {
      element.setAttribute('aria-label', label);
    }
  }

  /**
   * Set ARIA attributes for a status indicator
   */
  static setStatusAttributes(
    element: HTMLElement,
    status: string,
    live: 'polite' | 'assertive' = 'polite'
  ): void {
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', live);
    element.setAttribute('aria-atomic', 'true');
    element.textContent = status;
  }

  /**
   * Set ARIA attributes for an alert
   */
  static setAlertAttributes(
    element: HTMLElement,
    message: string,
    live: 'polite' | 'assertive' = 'assertive'
  ): void {
    element.setAttribute('role', 'alert');
    element.setAttribute('aria-live', live);
    element.setAttribute('aria-atomic', 'true');
    element.textContent = message;
  }
}