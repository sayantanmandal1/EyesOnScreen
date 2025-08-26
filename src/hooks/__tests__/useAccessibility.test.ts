import { renderHook, act } from '@testing-library/react';
import { useAccessibility } from '../useAccessibility';

// Mock accessibility utilities
jest.mock('../../utils/accessibility', () => ({
  announceToScreenReader: jest.fn(),
  setFocusToElement: jest.fn(),
  trapFocus: jest.fn().mockReturnValue(jest.fn()),
  checkColorContrast: jest.fn().mockReturnValue({ ratio: 21, passes: true }),
  validateKeyboardNavigation: jest.fn().mockReturnValue({
    focusableCount: 5,
    hasTabTrap: true,
    hasSkipLinks: true
  })
}));

import * as mockUtils from '../../utils/accessibility';

describe('useAccessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('screen reader announcements', () => {
    it('should announce messages to screen reader', () => {
      const { result } = renderHook(() => useAccessibility());

      act(() => {
        result.current.announce('Test message');
      });

      expect(mockUtils.announceToScreenReader).toHaveBeenCalledWith('Test message', 'polite');
    });

    it('should announce assertive messages', () => {
      const { result } = renderHook(() => useAccessibility());

      act(() => {
        result.current.announceUrgent('Urgent message');
      });

      expect(mockUtils.announceToScreenReader).toHaveBeenCalledWith('Urgent message', 'assertive');
    });

    it('should queue multiple announcements', () => {
      const { result } = renderHook(() => useAccessibility());

      act(() => {
        result.current.announce('First message');
        result.current.announce('Second message');
      });

      expect(mockUtils.announceToScreenReader).toHaveBeenCalledTimes(2);
    });
  });

  describe('focus management', () => {
    it('should set focus to element', () => {
      const { result } = renderHook(() => useAccessibility());

      act(() => {
        result.current.setFocus('#test-element');
      });

      expect(mockUtils.setFocusToElement).toHaveBeenCalledWith('#test-element');
    });

    it('should trap focus in container', () => {
      const { result } = renderHook(() => useAccessibility());
      const mockElement = document.createElement('div');

      act(() => {
        result.current.trapFocus(mockElement);
      });

      expect(mockUtils.trapFocus).toHaveBeenCalledWith(mockElement);
    });

    it('should cleanup focus trap on unmount', () => {
      const mockCleanup = jest.fn();
      mockUtils.trapFocus.mockReturnValue(mockCleanup);

      const { result, unmount } = renderHook(() => useAccessibility());
      const mockElement = document.createElement('div');

      act(() => {
        result.current.trapFocus(mockElement);
      });

      unmount();

      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('should handle keyboard events', () => {
      const onEscape = jest.fn();
      const onEnter = jest.fn();
      const { result } = renderHook(() => useAccessibility());

      act(() => {
        result.current.handleKeyboard({
          onEscape,
          onEnter
        });
      });

      // Simulate Escape key
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      expect(onEscape).toHaveBeenCalled();

      // Simulate Enter key
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      document.dispatchEvent(enterEvent);

      expect(onEnter).toHaveBeenCalled();
    });

    it('should cleanup keyboard listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      const { result, unmount } = renderHook(() => useAccessibility());

      act(() => {
        result.current.handleKeyboard({
          onEscape: jest.fn()
        });
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should handle arrow key navigation', () => {
      const onArrowUp = jest.fn();
      const onArrowDown = jest.fn();
      const { result } = renderHook(() => useAccessibility());

      act(() => {
        result.current.handleKeyboard({
          onArrowUp,
          onArrowDown
        });
      });

      const arrowUpEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      document.dispatchEvent(arrowUpEvent);

      expect(onArrowUp).toHaveBeenCalled();

      const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      document.dispatchEvent(arrowDownEvent);

      expect(onArrowDown).toHaveBeenCalled();
    });
  });

  describe('color contrast validation', () => {
    it('should validate color contrast', () => {
      const { result } = renderHook(() => useAccessibility());

      const contrastResult = result.current.validateContrast('#000000', '#ffffff');

      expect(mockUtils.checkColorContrast).toHaveBeenCalledWith('#000000', '#ffffff', 'AA');
      expect(contrastResult).toEqual({ ratio: 21, passes: true });
    });

    it('should validate with different WCAG levels', () => {
      const { result } = renderHook(() => useAccessibility());

      result.current.validateContrast('#000000', '#ffffff', 'AAA');

      expect(mockUtils.checkColorContrast).toHaveBeenCalledWith('#000000', '#ffffff', 'AAA');
    });
  });

  describe('navigation validation', () => {
    it('should validate keyboard navigation', () => {
      const { result } = renderHook(() => useAccessibility());
      const mockElement = document.createElement('div');

      const navigationResult = result.current.validateNavigation(mockElement);

      expect(mockUtils.validateKeyboardNavigation).toHaveBeenCalledWith(mockElement);
      expect(navigationResult).toEqual({
        focusableCount: 5,
        hasTabTrap: true,
        hasSkipLinks: true
      });
    });
  });

  describe('accessibility state', () => {
    it('should track accessibility preferences', () => {
      const { result } = renderHook(() => useAccessibility());

      expect(result.current.preferences).toEqual({
        reduceMotion: false,
        highContrast: false,
        screenReader: false
      });
    });

    it('should update accessibility preferences', () => {
      const { result } = renderHook(() => useAccessibility());

      act(() => {
        result.current.updatePreferences({
          reduceMotion: true,
          highContrast: true
        });
      });

      expect(result.current.preferences.reduceMotion).toBe(true);
      expect(result.current.preferences.highContrast).toBe(true);
      expect(result.current.preferences.screenReader).toBe(false);
    });

    it('should detect system accessibility preferences', () => {
      // Mock matchMedia
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('reduce-motion'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const { result } = renderHook(() => useAccessibility());

      expect(result.current.preferences.reduceMotion).toBe(true);
    });
  });

  describe('live regions', () => {
    it('should create and manage live regions', () => {
      const { result } = renderHook(() => useAccessibility());

      act(() => {
        result.current.createLiveRegion('status', 'polite');
      });

      expect(result.current.liveRegions.status).toBeDefined();

      act(() => {
        result.current.updateLiveRegion('status', 'Status updated');
      });

      // Verify the live region was updated
      expect(result.current.liveRegions.status.textContent).toBe('Status updated');
    });

    it('should cleanup live regions on unmount', () => {
      const { result, unmount } = renderHook(() => useAccessibility());

      act(() => {
        result.current.createLiveRegion('temp', 'assertive');
      });

      const liveRegion = result.current.liveRegions.temp;
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => liveRegion);

      unmount();

      expect(removeChildSpy).toHaveBeenCalledWith(liveRegion);
    });
  });

  describe('focus history', () => {
    it('should track focus history', () => {
      const { result } = renderHook(() => useAccessibility());
      const element1 = document.createElement('button');
      const element2 = document.createElement('input');

      act(() => {
        result.current.pushFocusHistory(element1);
        result.current.pushFocusHistory(element2);
      });

      expect(result.current.focusHistory).toHaveLength(2);
      expect(result.current.focusHistory[1]).toBe(element2);
    });

    it('should restore previous focus', () => {
      const { result } = renderHook(() => useAccessibility());
      const element1 = document.createElement('button');
      const element2 = document.createElement('input');
      
      element1.focus = jest.fn();
      element2.focus = jest.fn();

      act(() => {
        result.current.pushFocusHistory(element1);
        result.current.pushFocusHistory(element2);
      });

      act(() => {
        result.current.restoreFocus();
      });

      expect(element1.focus).toHaveBeenCalled();
      expect(result.current.focusHistory).toHaveLength(1);
    });

    it('should clear focus history', () => {
      const { result } = renderHook(() => useAccessibility());
      const element = document.createElement('button');

      act(() => {
        result.current.pushFocusHistory(element);
      });

      act(() => {
        result.current.clearFocusHistory();
      });

      expect(result.current.focusHistory).toHaveLength(0);
    });
  });
});