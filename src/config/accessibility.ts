/**
 * Accessibility configuration and color schemes
 * 
 * Defines WCAG-compliant color schemes and accessibility settings
 */

/**
 * WCAG-compliant color schemes
 */
export const AccessibleColors = {
  // Primary colors with sufficient contrast
  primary: {
    50: '#eff6ff',   // Very light blue
    100: '#dbeafe',  // Light blue
    500: '#3b82f6',  // Medium blue
    600: '#2563eb',  // Dark blue
    700: '#1d4ed8',  // Very dark blue
    900: '#1e3a8a'   // Darkest blue
  },

  // Success colors (green)
  success: {
    50: '#f0fdf4',   // Very light green
    100: '#dcfce7',  // Light green
    500: '#22c55e',  // Medium green
    600: '#16a34a',  // Dark green
    700: '#15803d',  // Very dark green
    900: '#14532d'   // Darkest green
  },

  // Warning colors (yellow/amber)
  warning: {
    50: '#fffbeb',   // Very light yellow
    100: '#fef3c7',  // Light yellow
    500: '#f59e0b',  // Medium yellow
    600: '#d97706',  // Dark yellow
    700: '#b45309',  // Very dark yellow
    900: '#78350f'   // Darkest yellow
  },

  // Error colors (red)
  error: {
    50: '#fef2f2',   // Very light red
    100: '#fee2e2',  // Light red
    500: '#ef4444',  // Medium red
    600: '#dc2626',  // Dark red
    700: '#b91c1c',  // Very dark red
    900: '#7f1d1d'   // Darkest red
  },

  // Neutral colors
  neutral: {
    50: '#f9fafb',   // Very light gray
    100: '#f3f4f6',  // Light gray
    300: '#d1d5db',  // Medium light gray
    500: '#6b7280',  // Medium gray
    600: '#4b5563',  // Dark gray
    700: '#374151',  // Very dark gray
    900: '#111827'   // Darkest gray
  }
};

/**
 * Color contrast ratios for different use cases
 */
export const ContrastRatios = {
  AA_NORMAL: 4.5,      // WCAG AA for normal text
  AA_LARGE: 3,         // WCAG AA for large text (18pt+ or 14pt+ bold)
  AAA_NORMAL: 7,       // WCAG AAA for normal text
  AAA_LARGE: 4.5,      // WCAG AAA for large text
  UI_COMPONENTS: 3     // WCAG AA for UI components
};

/**
 * Accessible color combinations that meet WCAG AA standards
 */
export const AccessibleCombinations = {
  // Alert combinations
  alerts: {
    success: {
      background: AccessibleColors.success[50],
      border: AccessibleColors.success[200],
      text: AccessibleColors.success[800],
      icon: AccessibleColors.success[600]
    },
    warning: {
      background: AccessibleColors.warning[50],
      border: AccessibleColors.warning[200],
      text: AccessibleColors.warning[800],
      icon: AccessibleColors.warning[600]
    },
    error: {
      background: AccessibleColors.error[50],
      border: AccessibleColors.error[200],
      text: AccessibleColors.error[800],
      icon: AccessibleColors.error[600]
    },
    info: {
      background: AccessibleColors.primary[50],
      border: AccessibleColors.primary[200],
      text: AccessibleColors.primary[800],
      icon: AccessibleColors.primary[600]
    }
  },

  // Button combinations
  buttons: {
    primary: {
      background: AccessibleColors.primary[600],
      text: '#ffffff',
      hover: AccessibleColors.primary[700],
      focus: AccessibleColors.primary[500],
      disabled: AccessibleColors.neutral[300]
    },
    secondary: {
      background: AccessibleColors.neutral[100],
      text: AccessibleColors.neutral[700],
      border: AccessibleColors.neutral[300],
      hover: AccessibleColors.neutral[200],
      focus: AccessibleColors.primary[500]
    },
    success: {
      background: AccessibleColors.success[600],
      text: '#ffffff',
      hover: AccessibleColors.success[700],
      focus: AccessibleColors.success[500]
    },
    danger: {
      background: AccessibleColors.error[600],
      text: '#ffffff',
      hover: AccessibleColors.error[700],
      focus: AccessibleColors.error[500]
    }
  },

  // Form combinations
  forms: {
    input: {
      background: '#ffffff',
      text: AccessibleColors.neutral[900],
      border: AccessibleColors.neutral[300],
      focus: AccessibleColors.primary[500],
      error: AccessibleColors.error[500],
      success: AccessibleColors.success[500]
    },
    label: {
      text: AccessibleColors.neutral[700],
      required: AccessibleColors.error[600]
    }
  },

  // Status indicators
  status: {
    online: AccessibleColors.success[500],
    offline: AccessibleColors.neutral[400],
    warning: AccessibleColors.warning[500],
    error: AccessibleColors.error[500],
    processing: AccessibleColors.primary[500]
  }
};

/**
 * Typography settings for accessibility
 */
export const AccessibleTypography = {
  // Font sizes (in rem)
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px (minimum for body text)
    lg: '1.125rem',   // 18px (large text threshold)
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem' // 30px
  },

  // Line heights for readability
  lineHeight: {
    tight: 1.25,
    normal: 1.5,      // Recommended minimum
    relaxed: 1.625,
    loose: 2
  },

  // Font weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,    // Minimum for large text to be considered "bold"
    bold: 700
  }
};

/**
 * Spacing and sizing for touch targets
 */
export const AccessibleSpacing = {
  // Minimum touch target size (44px x 44px per WCAG)
  minTouchTarget: '2.75rem', // 44px

  // Recommended spacing between interactive elements
  interactiveSpacing: '0.5rem', // 8px

  // Focus outline width
  focusOutlineWidth: '2px',

  // Border radius for better visual distinction
  borderRadius: {
    sm: '0.25rem',   // 4px
    md: '0.375rem',  // 6px
    lg: '0.5rem'     // 8px
  }
};

/**
 * Animation and transition settings
 */
export const AccessibleAnimations = {
  // Respect user's motion preferences
  respectMotionPreference: true,

  // Reduced motion alternatives
  reducedMotion: {
    duration: '0.01ms',
    easing: 'linear'
  },

  // Standard motion
  standardMotion: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms'
    },
    easing: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
  }
};

/**
 * Screen reader specific settings
 */
export const ScreenReaderSettings = {
  // Live region politeness levels
  liveRegions: {
    polite: 'polite',
    assertive: 'assertive',
    off: 'off'
  },

  // Common ARIA roles
  roles: {
    alert: 'alert',
    alertdialog: 'alertdialog',
    button: 'button',
    checkbox: 'checkbox',
    dialog: 'dialog',
    group: 'group',
    heading: 'heading',
    link: 'link',
    listbox: 'listbox',
    menu: 'menu',
    menuitem: 'menuitem',
    option: 'option',
    progressbar: 'progressbar',
    radio: 'radio',
    radiogroup: 'radiogroup',
    status: 'status',
    tab: 'tab',
    tablist: 'tablist',
    tabpanel: 'tabpanel',
    textbox: 'textbox'
  }
};

/**
 * Keyboard navigation settings
 */
export const KeyboardNavigation = {
  // Standard key codes
  keys: {
    ENTER: 'Enter',
    SPACE: ' ',
    ESCAPE: 'Escape',
    TAB: 'Tab',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    HOME: 'Home',
    END: 'End',
    PAGE_UP: 'PageUp',
    PAGE_DOWN: 'PageDown'
  },

  // Navigation patterns
  patterns: {
    // For radio groups, tabs, menus
    arrowKeys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
    
    // For activating buttons, links
    activation: ['Enter', ' '],
    
    // For closing dialogs, menus
    escape: ['Escape'],
    
    // For moving to start/end of lists
    homeEnd: ['Home', 'End']
  }
};

/**
 * Default accessibility configuration
 */
export const DefaultAccessibilityConfig = {
  colors: AccessibleColors,
  combinations: AccessibleCombinations,
  typography: AccessibleTypography,
  spacing: AccessibleSpacing,
  animations: AccessibleAnimations,
  screenReader: ScreenReaderSettings,
  keyboard: KeyboardNavigation,
  
  // Feature flags
  features: {
    highContrast: false,
    reducedMotion: false,
    largeText: false,
    screenReaderOptimized: false
  }
};