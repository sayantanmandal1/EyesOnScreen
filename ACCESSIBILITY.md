# Accessibility Guide

This document outlines the accessibility features implemented in the Eyes-On-Screen Proctored Quiz application and provides guidance for maintaining and extending these features.

## Overview

The application has been designed with accessibility as a core requirement, following WCAG 2.1 AA guidelines and implementing comprehensive support for:

- Screen readers and assistive technologies
- Keyboard-only navigation
- High contrast and color accessibility
- Focus management and visual indicators
- Semantic HTML and ARIA attributes

## Accessibility Features

### 1. Keyboard Navigation

#### Global Keyboard Shortcuts

- **Tab/Shift+Tab**: Navigate between interactive elements
- **Enter/Space**: Activate buttons and controls
- **Escape**: Close modals and return focus
- **Arrow Keys**: Navigate within question options
- **Ctrl+N**: Next question (when answered)
- **Ctrl+S**: Submit quiz (on last question)
- **?**: Show keyboard shortcuts help

#### Focus Management

- Focus trap within modals and quiz container
- Logical tab order throughout the application
- Visible focus indicators on all interactive elements
- Automatic focus restoration when closing modals
- Skip links for efficient navigation

### 2. Screen Reader Support

#### ARIA Attributes

- **role**: Proper semantic roles for all components
- **aria-label**: Descriptive labels for interactive elements
- **aria-labelledby**: References to heading elements
- **aria-describedby**: Additional context and help text
- **aria-live**: Dynamic content announcements
- **aria-expanded**: State of collapsible elements

#### Live Regions

- **Polite announcements**: Question changes, answer updates
- **Assertive announcements**: Alerts, time warnings
- **Status updates**: Progress indicators, completion states

#### Semantic Structure

- Proper heading hierarchy (h1, h2, h3)
- Landmark regions (main, header, footer, navigation)
- Lists and list items for structured content
- Fieldsets and legends for form groups

### 3. Visual Accessibility

#### Color and Contrast

- WCAG AA compliant color combinations (4.5:1 minimum ratio)
- High contrast mode support
- Color is not the only means of conveying information
- Consistent color usage throughout the application

#### Typography

- Minimum 16px font size for body text
- 1.5 line height for improved readability
- Clear font families with good character distinction
- Scalable text that works with browser zoom up to 200%

#### Visual Indicators

- Clear focus outlines (2px minimum)
- Consistent button and link styling
- Progress indicators with multiple visual cues
- Status icons with text alternatives

### 4. Form Accessibility

#### Input Fields

- Proper labels associated with all form controls
- Required field indicators
- Error messages linked to relevant fields
- Help text provided where needed
- Logical tab order through form elements

#### Question Types

- **Multiple Choice**: Radio button groups with fieldsets
- **Short Answer**: Labeled text areas with character counts
- **Progress Tracking**: Visual and programmatic progress indicators

### 5. Alert and Notification Accessibility

#### Alert Types

- **Soft Alerts**: Toast notifications with polite announcements
- **Hard Alerts**: Modal dialogs with assertive announcements
- **Time Warnings**: Progressive urgency levels

#### Alert Features

- Keyboard dismissible
- Screen reader announcements
- Focus management
- Clear action buttons
- Timeout controls with pause on hover/focus

## Implementation Details

### Components with Accessibility Features

#### QuestionRenderer

```typescript
// Proper ARIA structure for questions
<div role="group" aria-labelledby="question-text">
  <h2 id="question-text">{question.text}</h2>
  <fieldset>
    <legend className="sr-only">Choose one answer</legend>
    <div role="radiogroup" aria-labelledby="question-text">
      {/* Radio options */}
    </div>
  </fieldset>
</div>
```

#### AccessibleQuizContainer

- Focus trap implementation
- Skip link functionality
- Keyboard shortcut handling
- Live region management

#### NavigationControls

- Progress indicators with ARIA attributes
- Disabled state management
- Clear button labeling

#### CountdownDisplay

- Live region updates for time warnings
- Progress bar with proper ARIA attributes
- Visual and programmatic status indicators

### Utility Functions

#### FocusManager

- `pushFocus()`: Store and move focus
- `popFocus()`: Restore previous focus
- `createFocusTrap()`: Implement focus trapping
- `getFocusableElements()`: Find focusable elements

#### ScreenReaderAnnouncer

- `announce()`: General announcements
- `announceQuizEvent()`: Quiz-specific messages
- `announceAlert()`: High-priority alerts

#### KeyboardNavigation

- `handleArrowNavigation()`: Arrow key handling
- `handleHomeEndNavigation()`: Jump to start/end

## Testing

### Automated Testing

- Jest-axe integration for accessibility violations
- Screen reader simulation tests
- Keyboard navigation tests
- Color contrast validation
- ARIA attribute verification

### Manual Testing Checklist

#### Screen Reader Testing

- [ ] Test with NVDA (Windows)
- [ ] Test with JAWS (Windows)
- [ ] Test with VoiceOver (macOS)
- [ ] Verify all content is announced
- [ ] Check navigation landmarks work
- [ ] Validate live region announcements

#### Keyboard Testing

- [ ] Tab through entire interface
- [ ] Test all keyboard shortcuts
- [ ] Verify focus indicators are visible
- [ ] Check focus trap functionality
- [ ] Test escape key behavior

#### Visual Testing

- [ ] Test with 200% browser zoom
- [ ] Verify high contrast mode
- [ ] Check color-only information
- [ ] Validate focus indicators
- [ ] Test with custom stylesheets disabled

### Browser Testing

- Chrome with screen reader extensions
- Firefox with accessibility tools
- Safari with VoiceOver
- Edge with Narrator

## Configuration

### Accessibility Settings

```typescript
// Default configuration in src/config/accessibility.ts
export const DefaultAccessibilityConfig = {
  features: {
    highContrast: false,
    reducedMotion: false,
    largeText: false,
    screenReaderOptimized: false,
  },
};
```

### Color Schemes

WCAG-compliant color combinations are defined in `src/config/accessibility.ts`:

- Success: Green with 4.5:1+ contrast ratio
- Warning: Yellow/amber with 4.5:1+ contrast ratio
- Error: Red with 4.5:1+ contrast ratio
- Info: Blue with 4.5:1+ contrast ratio

## Best Practices

### Development Guidelines

1. **Always provide text alternatives**

   - Alt text for images
   - Labels for form controls
   - Descriptions for complex content

2. **Use semantic HTML**

   - Proper heading structure
   - Meaningful element choices
   - Landmark regions

3. **Implement keyboard support**

   - All functionality available via keyboard
   - Logical tab order
   - Visible focus indicators

4. **Provide clear feedback**

   - Status messages for actions
   - Error messages for problems
   - Progress indicators for processes

5. **Test early and often**
   - Automated accessibility testing
   - Manual keyboard testing
   - Screen reader validation

### Code Review Checklist

- [ ] All interactive elements are keyboard accessible
- [ ] ARIA attributes are used correctly
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus management is implemented properly
- [ ] Screen reader announcements are appropriate
- [ ] Error messages are associated with form fields
- [ ] Headings follow logical hierarchy
- [ ] Alternative text is provided for images

## Resources

### Tools

- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension for accessibility testing
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluation tool
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/) - Color contrast testing
- [Screen Reader Testing](https://webaim.org/articles/screenreader_testing/) - Screen reader testing guide

### Guidelines

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)

### Testing

- [Accessibility Testing Guide](https://www.a11yproject.com/posts/how-to-test-web-accessibility/)
- [Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [Keyboard Testing](https://webaim.org/techniques/keyboard/)

## Maintenance

### Regular Tasks

1. Run automated accessibility tests with each build
2. Perform manual keyboard testing for new features
3. Validate color contrast when updating designs
4. Test with screen readers for major changes
5. Review ARIA attributes for accuracy

### Updates and Improvements

- Monitor WCAG guideline updates
- Incorporate user feedback from accessibility testing
- Update color schemes based on contrast requirements
- Enhance keyboard shortcuts based on user needs
- Improve screen reader announcements based on testing

This accessibility implementation ensures that the Eyes-On-Screen Proctored Quiz is usable by all users, regardless of their abilities or the assistive technologies they use.
