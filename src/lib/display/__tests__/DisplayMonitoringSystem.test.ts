/**
 * Tests for DisplayMonitoringSystem
 */

import { DisplayMonitoringSystem, DisplayMonitoringConfig } from '../DisplayMonitoringSystem';
import { DisplayDetector } from '../DisplayDetector';
import { ScreenBehaviorMonitor } from '../ScreenBehaviorMonitor';

// Mock the component classes
jest.mock('../DisplayDetector');
jest.mock('../ScreenBehaviorMonitor');

const MockDisplayDetector = DisplayDetector as jest.MockedClass<typeof DisplayDetector>;
const MockScreenBehaviorMonitor = ScreenBehaviorMonitor as jest.MockedClass<typeof ScreenBehaviorMonitor>;

describe('DisplayMonitoringSystem', () => {
    let system: DisplayMonitoringSystem;
    let config: DisplayMonitoringConfig;
    let mockDisplayDetector: jest.Mocked<DisplayDetector>;
    let mockScreenBehaviorMonitor: jest.Mocked<ScreenBehaviorMonitor>;

    beforeEach(() => {
        config = {
            monitoring: {
                enabled: true,
                intervalMs: 1000,
                reflectionAnalysis: true,
                eyeMovementCorrelation: true
            },
            detection: {
                multipleMonitors: true,
                externalDisplays: true,
                tvProjectors: true,
                virtualMachineDisplays: true
            },
            thresholds: {
                reflectionConfidence: 0.7,
                eyeMovementCorrelation: 0.8,
                displayChangeDetection: 0.6
            },
            screenBehavior: {
                enabled: true,
                cursorTracking: true,
                windowFocusMonitoring: true,
                screenSharingDetection: true,
                fullscreenEnforcement: true,
                vmDisplayDetection: true
            },
            alerting: {
                immediateAlerts: true,
                threatThreshold: 0.7,
                autoBlock: false
            }
        };

        // Setup mocks
        mockDisplayDetector = {
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
            performDetection: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            getLastDetectionResult: jest.fn(),
            dispose: jest.fn()
        } as any;

        mockScreenBehaviorMonitor = {
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
            getMonitoringStatus: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispose: jest.fn()
        } as any;

        MockDisplayDetector.mockImplementation(() => mockDisplayDetector);
        MockScreenBehaviorMonitor.mockImplementation(() => mockScreenBehaviorMonitor);

        system = new DisplayMonitoringSystem(config);
    });

    afterEach(() => {
        system.dispose();
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should create component instances correctly', () => {
            expect(MockDisplayDetector).toHaveBeenCalledWith(config);
            expect(MockScreenBehaviorMonitor).toHaveBeenCalled();
        });

        it('should setup event handlers for components', () => {
            expect(mockDisplayDetector.addEventListener).toHaveBeenCalled();
            expect(mockScreenBehaviorMonitor.addEventListener).toHaveBeenCalled();
        });
    });

    describe('Monitoring Lifecycle', () => {
        it('should start monitoring correctly', async () => {
            mockDisplayDetector.performDetection.mockResolvedValue({
                displays: [{
                    id: 'primary',
                    isPrimary: true,
                    width: 1920,
                    height: 1080,
                    colorDepth: 24,
                    pixelRatio: 1,
                    orientation: 0,
                    type: 'internal'
                }],
                multipleDisplaysDetected: false,
                externalDisplaysDetected: false,
                tvProjectorDetected: false,
                virtualDisplayDetected: false,
                reflectionBasedScreens: [],
                eyeMovementCorrelation: {
                    correlationScore: 0.8,
                    suspiciousPatterns: [],
                    offScreenGazeDetected: false,
                    externalScreenInteraction: false,
                    confidence: 0.8
                },
                confidence: 0.9,
                timestamp: Date.now()
            });

            mockScreenBehaviorMonitor.getMonitoringStatus.mockReturnValue({
                cursorTracking: {
                    position: { x: 100, y: 100 },
                    velocity: { x: 0, y: 0 },
                    acceleration: { x: 0, y: 0 },
                    outsideViewport: false,
                    suspiciousMovement: false,
                    automatedBehavior: false,
                    confidence: 0.9
                },
                windowFocus: {
                    currentWindow: 'quiz-application',
                    focusChanges: [],
                    applicationSwitching: false,
                    suspiciousApplications: [],
                    backgroundActivity: false
                },
                screenSharing: {
                    isScreenSharing: false,
                    remoteDesktopDetected: false,
                    screenCastingDetected: false,
                    collaborationToolsDetected: [],
                    confidence: 0.9
                },
                fullscreenEnforcement: {
                    isFullscreen: true,
                    enforcementActive: true,
                    bypassAttempts: 0,
                    violations: []
                },
                virtualMachineDisplay: {
                    isVirtualDisplay: false,
                    vmSoftware: [],
                    displayDrivers: [],
                    resolutionAnomalies: false,
                    refreshRateAnomalies: false,
                    confidence: 0.9
                }
            });

            await system.startMonitoring();

            expect(mockDisplayDetector.startMonitoring).toHaveBeenCalled();
            expect(mockScreenBehaviorMonitor.startMonitoring).toHaveBeenCalled();
        });

        it('should stop monitoring correctly', async () => {
            // Start monitoring first
            await system.startMonitoring();

            // Then stop it
            system.stopMonitoring();

            expect(mockDisplayDetector.stopMonitoring).toHaveBeenCalled();
            expect(mockScreenBehaviorMonitor.stopMonitoring).toHaveBeenCalled();
        });

        it('should not start monitoring twice', async () => {
            mockDisplayDetector.performDetection.mockResolvedValue({
                displays: [],
                multipleDisplaysDetected: false,
                externalDisplaysDetected: false,
                tvProjectorDetected: false,
                virtualDisplayDetected: false,
                reflectionBasedScreens: [],
                eyeMovementCorrelation: {
                    correlationScore: 0,
                    suspiciousPatterns: [],
                    offScreenGazeDetected: false,
                    externalScreenInteraction: false,
                    confidence: 0
                },
                confidence: 0,
                timestamp: Date.now()
            });
            mockScreenBehaviorMonitor.getMonitoringStatus.mockReturnValue({
                cursorTracking: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, outsideViewport: false, suspiciousMovement: false, automatedBehavior: false, confidence: 0 },
                windowFocus: { currentWindow: '', focusChanges: [], applicationSwitching: false, suspiciousApplications: [], backgroundActivity: false },
                screenSharing: { isScreenSharing: false, remoteDesktopDetected: false, screenCastingDetected: false, collaborationToolsDetected: [], confidence: 0 },
                fullscreenEnforcement: { isFullscreen: false, enforcementActive: false, bypassAttempts: 0, violations: [] },
                virtualMachineDisplay: { isVirtualDisplay: false, vmSoftware: [], displayDrivers: [], resolutionAnomalies: false, refreshRateAnomalies: false, confidence: 0 }
            });

            await system.startMonitoring();
            await system.startMonitoring();

            expect(mockDisplayDetector.startMonitoring).toHaveBeenCalledTimes(1);
        });
    });

    describe('Threat Level Calculation', () => {
        it('should calculate low threat level for normal conditions', async () => {
            mockDisplayDetector.performDetection.mockResolvedValue({
                displays: [{ id: 'primary', isPrimary: true, width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1, orientation: 0, type: 'internal' }],
                multipleDisplaysDetected: false,
                externalDisplaysDetected: false,
                tvProjectorDetected: false,
                virtualDisplayDetected: false,
                reflectionBasedScreens: [],
                eyeMovementCorrelation: { correlationScore: 0.8, suspiciousPatterns: [], offScreenGazeDetected: false, externalScreenInteraction: false, confidence: 0.8 },
                confidence: 0.9,
                timestamp: Date.now()
            });

            mockScreenBehaviorMonitor.getMonitoringStatus.mockReturnValue({
                cursorTracking: { position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, outsideViewport: false, suspiciousMovement: false, automatedBehavior: false, confidence: 0.9 },
                windowFocus: { currentWindow: 'quiz-application', focusChanges: [], applicationSwitching: false, suspiciousApplications: [], backgroundActivity: false },
                screenSharing: { isScreenSharing: false, remoteDesktopDetected: false, screenCastingDetected: false, collaborationToolsDetected: [], confidence: 0.9 },
                fullscreenEnforcement: { isFullscreen: true, enforcementActive: true, bypassAttempts: 0, violations: [] },
                virtualMachineDisplay: { isVirtualDisplay: false, vmSoftware: [], displayDrivers: [], resolutionAnomalies: false, refreshRateAnomalies: false, confidence: 0.9 }
            });

            await system.startMonitoring();
            const result = await system.getCurrentStatus();
            expect(result.overallThreatLevel).toBe('low');
        });

        it('should calculate high threat level for multiple displays', async () => {
            mockDisplayDetector.performDetection.mockResolvedValue({
                displays: [
                    { id: 'primary', isPrimary: true, width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1, orientation: 0, type: 'internal' },
                    { id: 'secondary', isPrimary: false, width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1, orientation: 0, type: 'external' }
                ],
                multipleDisplaysDetected: true,
                externalDisplaysDetected: true,
                tvProjectorDetected: false,
                virtualDisplayDetected: false,
                reflectionBasedScreens: [],
                eyeMovementCorrelation: { correlationScore: 0.8, suspiciousPatterns: [], offScreenGazeDetected: false, externalScreenInteraction: false, confidence: 0.8 },
                confidence: 0.7,
                timestamp: Date.now()
            });

            mockScreenBehaviorMonitor.getMonitoringStatus.mockReturnValue({
                cursorTracking: { position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, outsideViewport: false, suspiciousMovement: false, automatedBehavior: false, confidence: 0.9 },
                windowFocus: { currentWindow: 'quiz-application', focusChanges: [], applicationSwitching: false, suspiciousApplications: [], backgroundActivity: false },
                screenSharing: { isScreenSharing: false, remoteDesktopDetected: false, screenCastingDetected: false, collaborationToolsDetected: [], confidence: 0.9 },
                fullscreenEnforcement: { isFullscreen: true, enforcementActive: true, bypassAttempts: 0, violations: [] },
                virtualMachineDisplay: { isVirtualDisplay: false, vmSoftware: [], displayDrivers: [], resolutionAnomalies: false, refreshRateAnomalies: false, confidence: 0.9 }
            });

            await system.startMonitoring();
            const result = await system.getCurrentStatus();
            expect(result.overallThreatLevel).toBe('high');
        });

        it('should calculate critical threat level for VM and screen sharing', async () => {
            mockDisplayDetector.performDetection.mockResolvedValue({
                displays: [{ id: 'primary', isPrimary: true, width: 1024, height: 768, colorDepth: 16, pixelRatio: 1, orientation: 0, type: 'virtual' }],
                multipleDisplaysDetected: false,
                externalDisplaysDetected: false,
                tvProjectorDetected: false,
                virtualDisplayDetected: true,
                reflectionBasedScreens: [],
                eyeMovementCorrelation: { correlationScore: 0.8, suspiciousPatterns: [], offScreenGazeDetected: false, externalScreenInteraction: false, confidence: 0.8 },
                confidence: 0.5,
                timestamp: Date.now()
            });

            mockScreenBehaviorMonitor.getMonitoringStatus.mockReturnValue({
                cursorTracking: { position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, outsideViewport: false, suspiciousMovement: false, automatedBehavior: false, confidence: 0.9 },
                windowFocus: { currentWindow: 'quiz-application', focusChanges: [], applicationSwitching: false, suspiciousApplications: [], backgroundActivity: false },
                screenSharing: { isScreenSharing: true, remoteDesktopDetected: true, screenCastingDetected: false, collaborationToolsDetected: ['teamviewer'], confidence: 0.3 },
                fullscreenEnforcement: { isFullscreen: false, enforcementActive: true, bypassAttempts: 3, violations: [] },
                virtualMachineDisplay: { isVirtualDisplay: true, vmSoftware: ['virtualbox'], displayDrivers: ['vmware'], resolutionAnomalies: true, refreshRateAnomalies: false, confidence: 0.2 }
            });

            await system.startMonitoring();
            const result = await system.getCurrentStatus();
            expect(result.overallThreatLevel).toBe('critical');
        });
    });

    describe('Recommendations Generation', () => {
        it('should generate appropriate recommendations for multiple displays', async () => {
            mockDisplayDetector.performDetection.mockResolvedValue({
                displays: [
                    { id: 'primary', isPrimary: true, width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1, orientation: 0, type: 'internal' },
                    { id: 'secondary', isPrimary: false, width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1, orientation: 0, type: 'external' }
                ],
                multipleDisplaysDetected: true,
                externalDisplaysDetected: true,
                tvProjectorDetected: false,
                virtualDisplayDetected: false,
                reflectionBasedScreens: [],
                eyeMovementCorrelation: { correlationScore: 0.8, suspiciousPatterns: [], offScreenGazeDetected: false, externalScreenInteraction: false, confidence: 0.8 },
                confidence: 0.7,
                timestamp: Date.now()
            });

            mockScreenBehaviorMonitor.getMonitoringStatus.mockReturnValue({
                cursorTracking: { position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, outsideViewport: false, suspiciousMovement: false, automatedBehavior: false, confidence: 0.9 },
                windowFocus: { currentWindow: 'quiz-application', focusChanges: [], applicationSwitching: false, suspiciousApplications: [], backgroundActivity: false },
                screenSharing: { isScreenSharing: false, remoteDesktopDetected: false, screenCastingDetected: false, collaborationToolsDetected: [], confidence: 0.9 },
                fullscreenEnforcement: { isFullscreen: true, enforcementActive: true, bypassAttempts: 0, violations: [] },
                virtualMachineDisplay: { isVirtualDisplay: false, vmSoftware: [], displayDrivers: [], resolutionAnomalies: false, refreshRateAnomalies: false, confidence: 0.9 }
            });

            await system.startMonitoring();
            const result = await system.getCurrentStatus();

            expect(result.recommendations).toContain('Disconnect additional monitors and use only the primary display');
            expect(result.recommendations).toContain('Remove external display connections during the quiz');
        });

        it('should generate recommendations for screen sharing', async () => {
            mockDisplayDetector.performDetection.mockResolvedValue({
                displays: [{ id: 'primary', isPrimary: true, width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1, orientation: 0, type: 'internal' }],
                multipleDisplaysDetected: false,
                externalDisplaysDetected: false,
                tvProjectorDetected: false,
                virtualDisplayDetected: false,
                reflectionBasedScreens: [],
                eyeMovementCorrelation: { correlationScore: 0.8, suspiciousPatterns: [], offScreenGazeDetected: false, externalScreenInteraction: false, confidence: 0.8 },
                confidence: 0.9,
                timestamp: Date.now()
            });

            mockScreenBehaviorMonitor.getMonitoringStatus.mockReturnValue({
                cursorTracking: { position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, outsideViewport: false, suspiciousMovement: false, automatedBehavior: false, confidence: 0.9 },
                windowFocus: { currentWindow: 'external', focusChanges: [], applicationSwitching: true, suspiciousApplications: ['chrome'], backgroundActivity: true },
                screenSharing: { isScreenSharing: true, remoteDesktopDetected: false, screenCastingDetected: false, collaborationToolsDetected: [], confidence: 0.5 },
                fullscreenEnforcement: { isFullscreen: false, enforcementActive: true, bypassAttempts: 2, violations: [] },
                virtualMachineDisplay: { isVirtualDisplay: false, vmSoftware: [], displayDrivers: [], resolutionAnomalies: false, refreshRateAnomalies: false, confidence: 0.9 }
            });

            await system.startMonitoring();
            const result = await system.getCurrentStatus();

            expect(result.recommendations).toContain('Close all other applications and focus only on the quiz');
            expect(result.recommendations).toContain('Stop all screen sharing and remote desktop sessions');
            expect(result.recommendations).toContain('Remain in fullscreen mode throughout the entire quiz');
        });
    });

    describe('Event Handling', () => {
        it('should handle display detector events', () => {
            const eventHandler = jest.fn();
            system.addEventListener(eventHandler);

            // Simulate display detector event
            const displayEventHandler = mockDisplayDetector.addEventListener.mock.calls[0][0];
            displayEventHandler({
                type: 'threat_detected',
                data: {
                    id: 'test-threat',
                    type: 'multiple_displays',
                    severity: 'high',
                    message: 'Test threat',
                    details: {},
                    timestamp: Date.now(),
                    resolved: false
                },
                timestamp: Date.now()
            });

            expect(eventHandler).toHaveBeenCalled();
        });

        it('should handle screen behavior monitor events', () => {
            const eventHandler = jest.fn();
            system.addEventListener(eventHandler);

            // Simulate screen behavior monitor event
            const screenEventHandler = mockScreenBehaviorMonitor.addEventListener.mock.calls[0][0];
            screenEventHandler({
                type: 'threat_detected',
                data: {
                    id: 'test-threat-2',
                    type: 'focus_violation',
                    severity: 'medium',
                    message: 'Test screen threat',
                    details: {},
                    timestamp: Date.now(),
                    resolved: false
                },
                timestamp: Date.now()
            });

            expect(eventHandler).toHaveBeenCalled();
        });

        it('should manage active threats correctly', () => {
            // Simulate threat detection
            const displayEventHandler = mockDisplayDetector.addEventListener.mock.calls[0][0];
            displayEventHandler({
                type: 'threat_detected',
                data: {
                    id: 'test-threat',
                    type: 'multiple_displays',
                    severity: 'high',
                    message: 'Test threat',
                    details: {},
                    timestamp: Date.now(),
                    resolved: false
                },
                timestamp: Date.now()
            });

            const activeThreats = system.getActiveThreats();
            expect(activeThreats).toHaveLength(1);
            expect(activeThreats[0].id).toBe('test-threat');
        });
    });

    describe('Configuration Management', () => {
        it('should update configuration correctly', () => {
            const newConfig = {
                alerting: {
                    immediateAlerts: false,
                    threatThreshold: 0.5,
                    autoBlock: true
                }
            };

            system.updateConfig(newConfig);

            // Configuration should be updated (we can't directly test private config,
            // but we can test that the system doesn't throw errors)
            expect(() => system.updateConfig(newConfig)).not.toThrow();
        });
    });

    describe('Statistics and Status', () => {
        it('should provide monitoring statistics', () => {
            mockDisplayDetector.getLastDetectionResult.mockReturnValue({
                displays: [],
                multipleDisplaysDetected: false,
                externalDisplaysDetected: false,
                tvProjectorDetected: false,
                virtualDisplayDetected: false,
                reflectionBasedScreens: [],
                eyeMovementCorrelation: { correlationScore: 0, suspiciousPatterns: [], offScreenGazeDetected: false, externalScreenInteraction: false, confidence: 0 },
                confidence: 0,
                timestamp: Date.now()
            });

            const stats = system.getMonitoringStatistics();

            expect(stats).toHaveProperty('isActive');
            expect(stats).toHaveProperty('uptime');
            expect(stats).toHaveProperty('threatsDetected');
            expect(stats).toHaveProperty('threatsResolved');
        });

        it('should clear resolved threats', () => {
            // Add a threat
            const displayEventHandler = mockDisplayDetector.addEventListener.mock.calls[0][0];
            displayEventHandler({
                type: 'threat_detected',
                data: {
                    id: 'test-threat',
                    type: 'multiple_displays',
                    severity: 'high',
                    message: 'Test threat',
                    details: {},
                    timestamp: Date.now(),
                    resolved: true
                },
                timestamp: Date.now()
            });

            system.clearResolvedThreats();

            const activeThreats = system.getActiveThreats();
            expect(activeThreats).toHaveLength(0);
        });
    });

    describe('Resource Cleanup', () => {
        it('should dispose resources correctly', () => {
            system.dispose();

            expect(mockDisplayDetector.dispose).toHaveBeenCalled();
            expect(mockScreenBehaviorMonitor.dispose).toHaveBeenCalled();
        });

        it('should handle multiple dispose calls', () => {
            system.dispose();
            system.dispose(); // Should not throw

            expect(mockDisplayDetector.dispose).toHaveBeenCalledTimes(2);
        });
    });

    describe('Error Handling', () => {
        it('should handle display detection errors gracefully', async () => {
            mockDisplayDetector.performDetection.mockRejectedValue(new Error('Detection failed'));
            mockScreenBehaviorMonitor.getMonitoringStatus.mockReturnValue({} as any);

            await expect(system.startMonitoring()).rejects.toThrow('Detection failed');
        });

        it('should handle event handler errors gracefully', () => {
            const errorHandler = jest.fn().mockImplementation(() => {
                throw new Error('Handler error');
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            system.addEventListener(errorHandler);

            // Trigger an event
            const displayEventHandler = mockDisplayDetector.addEventListener.mock.calls[0][0];
            displayEventHandler({
                type: 'display_change',
                data: {
                    displays: [],
                    multipleDisplaysDetected: false,
                    externalDisplaysDetected: false,
                    tvProjectorDetected: false,
                    virtualDisplayDetected: false,
                    reflectionBasedScreens: [],
                    eyeMovementCorrelation: {
                        correlationScore: 0,
                        suspiciousPatterns: [],
                        offScreenGazeDetected: false,
                        externalScreenInteraction: false,
                        confidence: 0
                    },
                    confidence: 0,
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            });

            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });
});