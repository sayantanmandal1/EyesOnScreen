/**
 * useAccessibility - Hook for managing accessibility features
 * 
 * Provides focus management, screen reader announcements, and keyboard navigation
 */

import { useEffect, useRef, useCallback } from 'react';
import { FocusManager, ScreenReaderAnnouncer, KeyboardNavigation } from '../utils/accessibility';

interface UseAccessibilityOptions {
  announcePageChanges?: boolean;
  manageFocus?: boolean;
  enableKeyboardShortcuts?: boolean;
  trapFocus?: boolean;
}

export const useAccessibility = (options: UseAccessibilityOptions = {}) => {
  const {
    announcePageChanges = true,
    manageFocus = true,
    enableKeyboardShortcuts = true,
    trapFocus = false
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const focusTrapCleanupRef = useRef<(() => void) | null>(null);

  // Focus management
  const pushFocus = useCallback((element: HTMLElement) => {
    if (manageFocus) {
      FocusManager.pushFocus(element);
    }
  }, [manageFocus]);

  const popFocus = useCallback(() => {
    if (manageFocus) {
      FocusManager.popFocus();
    }
  }, [manageFocus]);

  const focusFirstElement = useCallback(() => {
    if (!containerRef.current) return;
    
    const focusableElements = FocusManager.getFocusableElements(containerRef.current);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, []);

  // Screen reader announcements
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcePageChanges) {
      ScreenReaderAnnouncer.announce(message, priority);
    }
  }, [announcePageChanges]);

  const announceQuizEvent = useCallback((message: string) => {
    if (announcePageChanges) {
      ScreenReaderAnnouncer.announceQuizEvent(message);
    }
  }, [announcePageChanges]);

  const announceAlert = useCallback((message: string) => {
    ScreenReaderAnnouncer.announceAlert(message);
  }, []);

  // Keyboard navigation
  const handleArrowNavigation = useCallback((
    event: KeyboardEvent,
    options?: { horizontal?: boolean; vertical?: boolean; wrap?: boolean }
  ) => {
    if (!containerRef.current || !enableKeyboardShortcuts) return false;
    
    return KeyboardNavigation.handleArrowNavigation(event, containerRef.current, options);
  }, [enableKeyboardShortcuts]);

  const handleHomeEndNavigation = useCallback((event: KeyboardEvent) => {
    if (!containerRef.current || !enableKeyboardShortcuts) return false;
    
    return KeyboardNavigation.handleHomeEndNavigation(event, containerRef.current);
  }, [enableKeyboardShortcuts]);

  // Focus trap
  useEffect(() => {
    if (trapFocus && containerRef.current) {
      focusTrapCleanupRef.current = FocusManager.createFocusTrap(containerRef.current);
    }

    return () => {
      if (focusTrapCleanupRef.current) {
        focusTrapCleanupRef.current();
        focusTrapCleanupRef.current = null;
      }
    };
  }, [trapFocus]);

  // Keyboard event handling
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        if (handleArrowNavigation(event)) {
          return;
        }
      }

      // Handle Home/End keys
      if (['Home', 'End'].includes(event.key)) {
        if (handleHomeEndNavigation(event)) {
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, handleArrowNavigation, handleHomeEndNavigation]);

  return {
    containerRef,
    pushFocus,
    popFocus,
    focusFirstElement,
    announce,
    announceQuizEvent,
    announceAlert,
    handleArrowNavigation,
    handleHomeEndNavigation
  };
};

/**
 * useQuizAccessibility - Specialized hook for quiz accessibility
 */
export const useQuizAccessibility = () => {
  const accessibility = useAccessibility({
    announcePageChanges: true,
    manageFocus: true,
    enableKeyboardShortcuts: true,
    trapFocus: true
  });

  const announceQuestionChange = useCallback((
    questionNumber: number,
    totalQuestions: number,
    questionText: string
  ) => {
    const message = `Question ${questionNumber} of ${totalQuestions}: ${questionText}`;
    accessibility.announceQuizEvent(message);
  }, [accessibility]);

  const announceAnswerChange = useCallback((hasAnswer: boolean, questionType: string) => {
    const message = hasAnswer 
      ? `Answer provided for ${questionType} question`
      : `Answer cleared for ${questionType} question`;
    accessibility.announce(message, 'polite');
  }, [accessibility]);

  const announceTimeWarning = useCallback((timeRemaining: string, isQuestion: boolean) => {
    const context = isQuestion ? 'question' : 'quiz';
    const message = `Warning: ${timeRemaining} remaining for ${context}`;
    accessibility.announceAlert(message);
  }, [accessibility]);

  const announceNavigationAttempt = useCallback(() => {
    const message = 'Navigation is locked during the quiz for academic integrity';
    accessibility.announceAlert(message);
  }, [accessibility]);

  return {
    ...accessibility,
    announceQuestionChange,
    announceAnswerChange,
    announceTimeWarning,
    announceNavigationAttempt
  };
};

/**
 * useAlertAccessibility - Hook for accessible alert management
 */
export const useAlertAccessibility = () => {
  const previousAlertRef = useRef<HTMLElement | null>(null);

  const showAccessibleAlert = useCallback((
    alertElement: HTMLElement,
    message: string,
    type: 'soft' | 'hard' = 'soft'
  ) => {
    // Store previous focus
    previousAlertRef.current = document.activeElement as HTMLElement;

    // Set ARIA attributes
    alertElement.setAttribute('role', type === 'hard' ? 'alertdialog' : 'alert');
    alertElement.setAttribute('aria-live', type === 'hard' ? 'assertive' : 'polite');
    alertElement.setAttribute('aria-atomic', 'true');

    // Focus management for hard alerts
    if (type === 'hard') {
      const focusableElements = FocusManager.getFocusableElements(alertElement);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    // Announce to screen readers
    ScreenReaderAnnouncer.announceAlert(message);
  }, []);

  const hideAccessibleAlert = useCallback(() => {
    // Restore previous focus
    if (previousAlertRef.current) {
      previousAlertRef.current.focus();
      previousAlertRef.current = null;
    }
  }, []);

  return {
    showAccessibleAlert,
    hideAccessibleAlert
  };
};