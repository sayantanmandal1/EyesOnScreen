/**
 * useIntegrityEnforcer hook tests
 */

import { renderHook, act } from '@testing-library/react';
import { useIntegrityEnforcer, UseIntegrityEnforcerOptions } from '../useIntegrityEnforcer';
import { IntegrityConfig } from '../../lib/quiz/IntegrityEnforcer';

// Mock the IntegrityEnforcer class
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockRequestFullscreen = jest.fn().mockResolvedValue(true);
const mockIsFullscreen = jest.fn().mockReturnValue(false);
const mockClearViolations = jest.fn();
const mockGetViolations = jest.fn().mockReturnValue([]);
const mockDestroy = jest.fn();

jest.mock('../../lib/quiz/IntegrityEnforcer', () => ({
  IntegrityEnforcer: jest.fn().mockImplementation(() => ({
    start: mockStart,
    stop: mockStop,
    requestFullscreen: mockRequestFullscreen,
    isFullscreen: mockIsFullscreen,
    clearViolations: mockClearViolations,
    getViolations: mockGetViolations,
    destroy: mockDestroy
  }))
}));

describe('useIntegrityEnforcer', () => {
  const defaultConfig: IntegrityConfig = {
    preventCopyPaste: true,
    blockRightClick: true,
    blockDevTools: true,
    enforceFullscreen: true,
    monitorPageVisibility: true,
    flagOnViolation: true,
    gracePeriodMs: 1000
  };

  const defaultOptions: UseIntegrityEnforcerOptions = {
    config: defaultConfig
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStart.mockClear();
    mockStop.mockClear();
    mockRequestFullscreen.mockClear();
    mockIsFullscreen.mockClear();
    mockClearViolations.mockClear();
    mockGetViolations.mockClear();
    mockDestroy.mockClear();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useIntegrityEnforcer(defaultOptions));

    expect(result.current.enforcer).toBeDefined();
    expect(result.current.isActive).toBe(false);
    expect(result.current.violations).toEqual([]);
    expect(typeof result.current.start).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.requestFullscreen).toBe('function');
    expect(typeof result.current.isFullscreen).toBe('function');
    expect(typeof result.current.clearViolations).toBe('function');
  });

  it('should start enforcement when start is called', () => {
    const { result } = renderHook(() => useIntegrityEnforcer(defaultOptions));

    act(() => {
      result.current.start();
    });

    expect(mockStart).toHaveBeenCalled();
  });

  it('should stop enforcement when stop is called', () => {
    const { result } = renderHook(() => useIntegrityEnforcer(defaultOptions));

    act(() => {
      result.current.start();
      result.current.stop();
    });

    expect(mockStop).toHaveBeenCalled();
  });

  it('should request fullscreen', async () => {
    const { result } = renderHook(() => useIntegrityEnforcer(defaultOptions));

    let fullscreenResult: boolean | undefined;
    await act(async () => {
      fullscreenResult = await result.current.requestFullscreen();
    });

    expect(mockRequestFullscreen).toHaveBeenCalled();
    expect(fullscreenResult).toBe(true);
  });

  it('should check fullscreen status', () => {
    const { result } = renderHook(() => useIntegrityEnforcer(defaultOptions));

    act(() => {
      const isFullscreen = result.current.isFullscreen();
      expect(isFullscreen).toBe(false);
    });

    expect(mockIsFullscreen).toHaveBeenCalled();
  });

  it('should clear violations', () => {
    const { result } = renderHook(() => useIntegrityEnforcer(defaultOptions));

    act(() => {
      result.current.clearViolations();
    });

    expect(mockClearViolations).toHaveBeenCalled();
  });

  it('should call callbacks when provided', () => {
    const onViolation = jest.fn();
    const onFlag = jest.fn();
    const onFullscreenExit = jest.fn();
    const onTabBlur = jest.fn();

    const options: UseIntegrityEnforcerOptions = {
      config: defaultConfig,
      onViolation,
      onFlag,
      onFullscreenExit,
      onTabBlur
    };

    renderHook(() => useIntegrityEnforcer(options));

    // Verify that the IntegrityEnforcer was created with callbacks
    const { IntegrityEnforcer } = require('../../lib/quiz/IntegrityEnforcer');
    expect(IntegrityEnforcer).toHaveBeenCalledWith(
      defaultConfig,
      expect.objectContaining({
        onViolation: expect.any(Function),
        onFlag,
        onFullscreenExit,
        onTabBlur
      })
    );
  });

  it('should cleanup on unmount', () => {
    const { result, unmount } = renderHook(() => useIntegrityEnforcer(defaultOptions));

    const enforcer = result.current.enforcer;
    
    unmount();

    expect(mockDestroy).toHaveBeenCalled();
  });

  it('should recreate enforcer when config changes', () => {
    const { result, rerender } = renderHook(
      (props: UseIntegrityEnforcerOptions) => useIntegrityEnforcer(props),
      { initialProps: defaultOptions }
    );

    const firstEnforcer = result.current.enforcer;

    const newConfig: IntegrityConfig = {
      ...defaultConfig,
      preventCopyPaste: false
    };

    rerender({ config: newConfig });

    expect(mockDestroy).toHaveBeenCalled();
    expect(result.current.enforcer).not.toBe(firstEnforcer);
  });

  it('should handle violations correctly', () => {
    const violations: any[] = [];
    const onViolation = jest.fn((violation) => violations.push(violation));

    const options: UseIntegrityEnforcerOptions = {
      config: defaultConfig,
      onViolation
    };

    renderHook(() => useIntegrityEnforcer(options));

    // Simulate violation callback
    const { IntegrityEnforcer } = require('../../lib/quiz/IntegrityEnforcer');
    const mockEnforcerInstance = IntegrityEnforcer.mock.results[0].value;
    const callbacks = IntegrityEnforcer.mock.calls[0][1];

    const testViolation = {
      type: 'copy-paste',
      timestamp: Date.now(),
      details: { action: 'copy' }
    };

    act(() => {
      callbacks.onViolation(testViolation);
    });

    expect(onViolation).toHaveBeenCalledWith(testViolation);
    expect(violations).toContain(testViolation);
  });

  it('should handle enforcer creation gracefully', () => {
    const { result } = renderHook(() => useIntegrityEnforcer(defaultOptions));

    expect(result.current.enforcer).toBeDefined();

    // These should work normally
    act(() => {
      result.current.start();
      result.current.stop();
    });

    expect(mockStart).toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalled();
  });

  it('should handle async fullscreen request failure', async () => {
    mockRequestFullscreen.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useIntegrityEnforcer(defaultOptions));

    let fullscreenResult: boolean | undefined;
    await act(async () => {
      fullscreenResult = await result.current.requestFullscreen();
    });

    expect(fullscreenResult).toBe(false);
    expect(mockRequestFullscreen).toHaveBeenCalled();
  });
});