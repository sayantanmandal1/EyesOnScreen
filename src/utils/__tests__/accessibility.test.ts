import {
  announceToScreenReader,
  setFocusToElement,
  trapFocus,
  getAccessibleName,
  checkColorContrast,
  validateKeyboardNavigation,
  createAriaLiveRegion,
  manageFocusOrder,
  addSkipLink
} from '../accessibility';

// Mock DOM methods
const mockElement = {
  focus: jest.fn(),
  setAttribute: jest.fn(),
  getAttribute: jest.fn(),
  removeAttribute: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  contains: jest.fn(),
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  textContent: '',
  id: 'test-element',
  tagName: 'DIV',
  tabIndex: 0
};

const mockDocument = {
  createElement: jest.fn().mockReturnValue(mockElement),
  getElementById: jest.fn().mockReturnValue(mockElement),
  querySelector: jest.fn().mockReturnValue(mockElement),
  querySelectorAll: jest.fn().mockReturnValue([mockElement]),
  activeElement: mockElement,
  body: mockElement
};

Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true
});

describe('Accessibility Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('announceToScreenReader', () => {
    it('should create and announce message to screen reader', () => {
      announceToScreenReader('Test announcement');

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('class', 'sr-only');
    });

    it('should handle assertive announcements', () => {
      announceToScreenReader('Urgent message', 'assertive');

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-live', 'assertive');
    });

    it('should clean up announcement after delay', (done) => {
      announceToScreenReader('Test message');

      setTimeout(() => {
        expect(mockElement.removeChild).toHaveBeenCalled();
        done();
      }, 1100);
    });
  });

  describe('setFocusToElement', () => {
    it('should set focus to element by selector', () => {
      setFocusToElement('#test-element');

      expect(mockDocument.querySelector).toHaveBeenCalledWith('#test-element');
      expect(mockElement.focus).toHaveBeenCalled();
    });

    it('should set focus to element object', () => {
      setFocusToElement(mockElement as any);

      expect(mockElement.focus).toHaveBeenCalled();
    });

    it('should handle non-existent elements gracefully', () => {
      mockDocument.querySelector.mockReturnValueOnce(null);

      expect(() => setFocusToElement('#non-existent')).not.toThrow();
    });

    it('should set tabindex if element is not focusable', () => {
      const nonFocusableElement = {
        ...mockElement,
        tabIndex: -1,
        tagName: 'DIV'
      };
      mockDocument.querySelector.mockReturnValueOnce(nonFocusableElement);

      setFocusToElement('#non-focusable');

      expect(nonFocusableElement.setAttribute).toHaveBeenCalledWith('tabindex', '0');
    });
  });

  describe('trapFocus', () => {
    it('should trap focus within container', () => {
      const focusableElements = [mockElement, { ...mockElement }, { ...mockElement }];
      mockElement.querySelectorAll.mockReturnValue(focusableElements);

      const cleanup = trapFocus(mockElement as any);

      expect(mockElement.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

      // Test Tab key handling
      const keydownHandler = mockElement.addEventListener.mock.calls[0][1];
      const tabEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
        target: focusableElements[2]
      };

      keydownHandler(tabEvent);

      expect(focusableElements[0].focus).toHaveBeenCalled();
      expect(tabEvent.preventDefault).toHaveBeenCalled();

      cleanup();
      expect(mockElement.removeEventListener).toHaveBeenCalled();
    });

    it('should handle Shift+Tab for reverse navigation', () => {
      const focusableElements = [mockElement, { ...mockElement }, { ...mockElement }];
      mockElement.querySelectorAll.mockReturnValue(focusableElements);

      trapFocus(mockElement as any);

      const keydownHandler = mockElement.addEventListener.mock.calls[0][1];
      const shiftTabEvent = {
        key: 'Tab',
        shiftKey: true,
        preventDefault: jest.fn(),
        target: focusableElements[0]
      };

      keydownHandler(shiftTabEvent);

      expect(focusableElements[2].focus).toHaveBeenCalled();
    });
  });

  describe('getAccessibleName', () => {
    it('should get accessible name from aria-label', () => {
      mockElement.getAttribute.mockImplementation((attr) => {
        if (attr === 'aria-label') return 'Accessible Label';
        return null;
      });

      const name = getAccessibleName(mockElement as any);
      expect(name).toBe('Accessible Label');
    });

    it('should get accessible name from aria-labelledby', () => {
      const labelElement = { ...mockElement, textContent: 'Label Text' };
      mockElement.getAttribute.mockImplementation((attr) => {
        if (attr === 'aria-labelledby') return 'label-id';
        return null;
      });
      mockDocument.getElementById.mockReturnValue(labelElement);

      const name = getAccessibleName(mockElement as any);
      expect(name).toBe('Label Text');
    });

    it('should get accessible name from associated label', () => {
      const labelElement = { ...mockElement, textContent: 'Input Label' };
      mockElement.getAttribute.mockImplementation((attr) => {
        if (attr === 'id') return 'input-id';
        return null;
      });
      mockDocument.querySelector.mockReturnValue(labelElement);

      const name = getAccessibleName(mockElement as any);
      expect(name).toBe('Input Label');
    });

    it('should fallback to text content', () => {
      mockElement.getAttribute.mockReturnValue(null);
      mockDocument.querySelector.mockReturnValue(null);
      mockElement.textContent = 'Element Text';

      const name = getAccessibleName(mockElement as any);
      expect(name).toBe('Element Text');
    });
  });

  describe('checkColorContrast', () => {
    it('should calculate color contrast ratio', () => {
      const ratio = checkColorContrast('#000000', '#ffffff');
      expect(ratio).toBeCloseTo(21, 1);
    });

    it('should handle same colors', () => {
      const ratio = checkColorContrast('#ffffff', '#ffffff');
      expect(ratio).toBe(1);
    });

    it('should validate WCAG AA compliance', () => {
      const result = checkColorContrast('#000000', '#ffffff', 'AA');
      expect(result.ratio).toBeCloseTo(21, 1);
      expect(result.passes).toBe(true);
    });

    it('should validate WCAG AAA compliance', () => {
      const result = checkColorContrast('#767676', '#ffffff', 'AAA');
      expect(result.passes).toBe(false);
    });

    it('should handle invalid color formats', () => {
      const result = checkColorContrast('invalid', '#ffffff');
      expect(result.ratio).toBe(1);
      expect(result.passes).toBe(false);
    });
  });

  describe('validateKeyboardNavigation', () => {
    it('should validate keyboard navigation', () => {
      const focusableElements = [
        { ...mockElement, tabIndex: 0 },
        { ...mockElement, tabIndex: 0 },
        { ...mockElement, tabIndex: -1 }
      ];
      mockElement.querySelectorAll.mockReturnValue(focusableElements);

      const result = validateKeyboardNavigation(mockElement as any);

      expect(result.focusableCount).toBe(2);
      expect(result.hasTabTrap).toBe(false);
      expect(result.hasSkipLinks).toBe(false);
    });

    it('should detect tab traps', () => {
      mockElement.querySelector.mockReturnValue(mockElement);

      const result = validateKeyboardNavigation(mockElement as any);

      expect(result.hasTabTrap).toBe(true);
    });

    it('should detect skip links', () => {
      mockElement.querySelector.mockImplementation((selector) => {
        if (selector.includes('skip')) return mockElement;
        return null;
      });

      const result = validateKeyboardNavigation(mockElement as any);

      expect(result.hasSkipLinks).toBe(true);
    });
  });

  describe('createAriaLiveRegion', () => {
    it('should create aria live region', () => {
      const region = createAriaLiveRegion('test-region', 'polite');

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('id', 'test-region');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
    });

    it('should update existing region', () => {
      mockDocument.getElementById.mockReturnValue(mockElement);

      const region = createAriaLiveRegion('existing-region');

      expect(mockDocument.createElement).not.toHaveBeenCalled();
      expect(region).toBe(mockElement);
    });

    it('should announce message to region', () => {
      const region = createAriaLiveRegion('announce-region');
      
      region.announce('Test message');

      expect(mockElement.textContent).toBe('Test message');
    });
  });

  describe('manageFocusOrder', () => {
    it('should set focus order for elements', () => {
      const elements = [mockElement, { ...mockElement }, { ...mockElement }];

      manageFocusOrder(elements as any[]);

      elements.forEach((el, index) => {
        expect(el.setAttribute).toHaveBeenCalledWith('tabindex', index.toString());
      });
    });

    it('should handle empty element list', () => {
      expect(() => manageFocusOrder([])).not.toThrow();
    });

    it('should skip null elements', () => {
      const elements = [mockElement, null, { ...mockElement }];

      expect(() => manageFocusOrder(elements as any[])).not.toThrow();
    });
  });

  describe('addSkipLink', () => {
    it('should add skip link to page', () => {
      const skipLink = addSkipLink('Skip to main content', '#main');

      expect(mockDocument.createElement).toHaveBeenCalledWith('a');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('href', '#main');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('class', 'skip-link');
      expect(mockElement.textContent).toBe('Skip to main content');
    });

    it('should handle skip link activation', () => {
      const targetElement = { ...mockElement };
      mockDocument.querySelector.mockReturnValue(targetElement);

      addSkipLink('Skip to content', '#content');

      const clickHandler = mockElement.addEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1];

      const clickEvent = { preventDefault: jest.fn() };
      clickHandler(clickEvent);

      expect(clickEvent.preventDefault).toHaveBeenCalled();
      expect(targetElement.focus).toHaveBeenCalled();
    });

    it('should show skip link on focus', () => {
      addSkipLink('Skip link', '#target');

      const focusHandler = mockElement.addEventListener.mock.calls.find(
        call => call[0] === 'focus'
      )[1];

      focusHandler();

      expect(mockElement.setAttribute).toHaveBeenCalledWith('class', 'skip-link skip-link-visible');
    });
  });
});