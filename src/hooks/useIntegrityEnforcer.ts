/**
 * useIntegrityEnforcer - React hook for managing academic integrity enforcement
 */

import { useEffect, useRef, useCallback } from 'react';
import { IntegrityEnforcer, IntegrityConfig, IntegrityCallbacks } from '../lib/quiz/IntegrityEnforcer';
import { IntegrityViolation } from '../lib/quiz/types';
import { FlagEvent } from '../lib/proctoring/types';

export interface UseIntegrityEnforcerOptions {
  config: IntegrityConfig;
  onViolation?: (violation: IntegrityViolation) => void;
  onFlag?: (flag: FlagEvent) => void;
  onFullscreenExit?: () => void;
  onTabBlur?: () => void;
}

export interface UseIntegrityEnforcerReturn {
  enforcer: IntegrityEnforcer | null;
  isActive: boolean;
  violations: IntegrityViolation[];
  start: () => void;
  stop: () => void;
  requestFullscreen: () => Promise<boolean>;
  isFullscreen: () => boolean;
  clearViolations: () => void;
}

export function useIntegrityEnforcer({
  config,
  onViolation,
  onFlag,
  onFullscreenExit,
  onTabBlur
}: UseIntegrityEnforcerOptions): UseIntegrityEnforcerReturn {
  const enforcerRef = useRef<IntegrityEnforcer | null>(null);
  const isActiveRef = useRef(false);
  const violationsRef = useRef<IntegrityViolation[]>([]);

  // Initialize enforcer
  useEffect(() => {
    const callbacks: IntegrityCallbacks = {
      onViolation: (violation) => {
        violationsRef.current.push(violation);
        onViolation?.(violation);
      },
      onFlag,
      onFullscreenExit,
      onTabBlur
    };

    enforcerRef.current = new IntegrityEnforcer(config, callbacks);

    return () => {
      if (enforcerRef.current) {
        enforcerRef.current.destroy();
        enforcerRef.current = null;
      }
    };
  }, [config, onViolation, onFlag, onFullscreenExit, onTabBlur]);

  const start = useCallback(() => {
    if (enforcerRef.current && !isActiveRef.current) {
      enforcerRef.current.start();
      isActiveRef.current = true;
    }
  }, []);

  const stop = useCallback(() => {
    if (enforcerRef.current && isActiveRef.current) {
      enforcerRef.current.stop();
      isActiveRef.current = false;
    }
  }, []);

  const requestFullscreen = useCallback(async (): Promise<boolean> => {
    if (enforcerRef.current) {
      return await enforcerRef.current.requestFullscreen();
    }
    return false;
  }, []);

  const isFullscreen = useCallback((): boolean => {
    if (enforcerRef.current) {
      return enforcerRef.current.isFullscreen();
    }
    return false;
  }, []);

  const clearViolations = useCallback(() => {
    if (enforcerRef.current) {
      enforcerRef.current.clearViolations();
      violationsRef.current = [];
    }
  }, []);

  return {
    enforcer: enforcerRef.current,
    isActive: isActiveRef.current,
    violations: violationsRef.current,
    start,
    stop,
    requestFullscreen,
    isFullscreen,
    clearViolations
  };
}