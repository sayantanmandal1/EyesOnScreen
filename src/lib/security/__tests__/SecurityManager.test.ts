/**
 * SecurityManager unit tests
 */

import { SecurityManager } from '../SecurityManager';
import { PermissionEnforcer } from '../PermissionEnforcer';
import { BrowserSecurityDetector } from '../BrowserSecurityDetector';
import { VirtualMachineDetector } from '../VirtualMachineDetector';
import { SystemIntegrityMonitor } from '../SystemIntegrityMonitor';
import { ContinuousVerifier } from '../ContinuousVerifier';
import type { SecurityConfig, SecurityStatus, SecurityThreat } from '../types';

// Mock the security components
jest.mock('../PermissionEnforcer');
jest.mock('../BrowserSecurityDetector');
jest.mock('../VirtualMachineDetector');
jest.mock('../SystemIntegrityMonitor');
jest.mock('../ContinuousVerifier');

const MockedPermissionEnforcer = PermissionEnforcer as jest.MockedClass<typeof PermissionEnforcer>;
const MockedBrowserSecurityDetector = BrowserSecurityDetector as jest.MockedClass<typeof BrowserSecurityDetector>;
const MockedVirtualMachineDetector = VirtualMachineDetector as jest.MockedClass<typeof VirtualMachineDetector>;
const MockedSystemIntegrityMonitor = SystemIntegrityMonitor as jest.MockedClass<typeof SystemIntegrityMonitor>;
const MockedContinuousVerifier = ContinuousVerifier as jest.MockedClass<typeof ContinuousVerifier>;

describe('SecurityManager', () => {
  let securityManager: SecurityManager;
  let mockPermissionEnforcer: jest.Mocked<PermissionEnforcer>;
  let mockBrowserSecurityDetector: jest.Mocked<BrowserSecurityDetector>;
  let mockVmDetector: jest.Mocked<VirtualMachineDetector>;
  let mockIntegrityMonitor: jest.Mocked<SystemIntegrityMonitor>;
  let mockContinuousVerifier: jest.Mocked<ContinuousVerifier>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockPermissionEnforcer = {
      enforcePermissions: jest.fn(),
      addEventListener: jest.fn(),
      destroy: jest.fn()
    } as any;

    mockBrowserSecurityDetector = {
      performCheck: jest.fn(),
      startMonitoring: jest.fn(),
      addEventListener: jest.fn(),
      stop: jest.fn()
    } as any;

    mockVmDetector = {
      detect: jest.fn(),
      addEventListener: jest.fn(),
      destroy: jest.fn()
    } as any;

    mockIntegrityMonitor = {
      performCheck: jest.fn(),
      startMonitoring: jest.fn(),
      addEventListener: jest.fn(),
      stop: jest.fn()
    } as any;

    mockContinuousVerifier = {
      start: jest.fn(),
      stop: jest.fn()
    } as any;

    // Configure mocks to return instances
    MockedPermissionEnforcer.mockImplementation(() => mockPermissionEnforcer);
    MockedBrowserSecurityDetector.mockImplementation(() => mockBrowserSecurityDetector);
    MockedVirtualMachineDetector.mockImplementation(() => mockVmDetector);
    MockedSystemIntegrityMonitor.mockImplementation(() => mockIntegrityMonitor);
    MockedContinuousVerifier.mockImplementation(() => mockContinuousVerifier);
  });

  afterEach(() => {
    if (securityManager) {
      securityManager.destroy();
    }
  });

  describe('constructor', () => {
    it('should create SecurityManager with default config', () => {
      securityManager = new SecurityManager();
      
      expect(MockedPermissionEnforcer).toHaveBeenCalledWith(
        expect.objectContaining({
          camera: expect.objectContaining({
            required: true,
            allowOptOut: false,
            continuousVerification: true
          })
        })
      );
      
      expect(MockedBrowserSecurityDetector).toHaveBeenCalledWith(
        expect.objectContaining({
          blockDeveloperTools: true,
          blockExtensions: true,
          blockModifications: true
        })
      );
    });

    it('should merge custom config with defaults', () => {
      const customConfig: Partial<SecurityConfig> = {
        permissions: {
          camera: {
            required: true,
            allowOptOut: false,
            continuousVerification: true,
            verificationIntervalMs: 3000
          },
          microphone: {
            required: true,
            allowOptOut: false,
            continuousVerification: true,
            verificationIntervalMs: 3000
          },
          screen: {
            required: true,
            allowOptOut: false,
            continuousVerification: true,
            verificationIntervalMs: 3000
          }
        }
      };

      securityManager = new SecurityManager(customConfig);
      
      expect(MockedPermissionEnforcer).toHaveBeenCalledWith(
        expect.objectContaining({
          camera: expect.objectContaining({
            verificationIntervalMs: 3000
          })
        })
      );
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      securityManager = new SecurityManager();
    });

    it('should initialize successfully with no threats', async () => {
      // Mock successful initialization
      mockVmDetector.detect.mockResolvedValue({
        isVirtualMachine: false,
        isEmulated: false,
        detectionMethods: [],
        confidence: 0,
        details: {}
      });

      mockBrowserSecurityDetector.performCheck.mockResolvedValue({
        developerToolsOpen: false,
        extensionsDetected: [],
        browserModifications: [],
        securityViolations: [],
        lastChecked: Date.now()
      });

      mockPermissionEnforcer.enforcePermissions.mockResolvedValue({
        camera: { granted: true, active: true, lastVerified: Date.now() },
        microphone: { granted: true, active: true, lastVerified: Date.now() },
        screen: { granted: true, active: true, lastVerified: Date.now() }
      });

      const status = await securityManager.initialize();
      
      expect(status.overall).toBe('secure');
      expect(mockVmDetector.detect).toHaveBeenCalled();
      expect(mockBrowserSecurityDetector.performCheck).toHaveBeenCalled();
      expect(mockPermissionEnforcer.enforcePermissions).toHaveBeenCalled();
      expect(mockContinuousVerifier.start).toHaveBeenCalled();
      expect(mockBrowserSecurityDetector.startMonitoring).toHaveBeenCalled();
      expect(mockIntegrityMonitor.startMonitoring).toHaveBeenCalled();
    });

    it('should detect VM and create threat', async () => {
      mockVmDetector.detect.mockResolvedValue({
        isVirtualMachine: true,
        isEmulated: false,
        detectionMethods: ['user_agent_analysis'],
        confidence: 0.8,
        details: { detected: true }
      });

      mockBrowserSecurityDetector.performCheck.mockResolvedValue({
        developerToolsOpen: false,
        extensionsDetected: [],
        browserModifications: [],
        securityViolations: [],
        lastChecked: Date.now()
      });

      mockPermissionEnforcer.enforcePermissions.mockResolvedValue({
        camera: { granted: true, active: true, lastVerified: Date.now() },
        microphone: { granted: true, active: true, lastVerified: Date.now() },
        screen: { granted: true, active: true, lastVerified: Date.now() }
      });

      const status = await securityManager.initialize();
      
      expect(status.overall).toBe('blocked');
      expect(status.threats).toHaveLength(1);
      expect(status.threats[0].type).toBe('vm_detected');
      expect(status.threats[0].severity).toBe('critical');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Permission denied');
      
      // Mock VM detector to return valid result
      mockVmDetector.detect.mockResolvedValue({
        isVirtualMachine: false,
        isEmulated: false,
        detectionMethods: [],
        confidence: 0,
        details: {}
      });

      // Mock browser security detector
      mockBrowserSecurityDetector.performCheck.mockResolvedValue({
        developerToolsOpen: false,
        extensionsDetected: [],
        browserModifications: [],
        securityViolations: [],
        lastChecked: Date.now()
      });

      // Make permission enforcer fail
      mockPermissionEnforcer.enforcePermissions.mockRejectedValue(error);

      await expect(securityManager.initialize()).rejects.toThrow('Permission denied');
    });

    it('should throw error if already initialized', async () => {
      // Mock successful first initialization
      mockVmDetector.detect.mockResolvedValue({
        isVirtualMachine: false,
        isEmulated: false,
        detectionMethods: [],
        confidence: 0,
        details: {}
      });

      mockBrowserSecurityDetector.performCheck.mockResolvedValue({
        developerToolsOpen: false,
        extensionsDetected: [],
        browserModifications: [],
        securityViolations: [],
        lastChecked: Date.now()
      });

      mockPermissionEnforcer.enforcePermissions.mockResolvedValue({
        camera: { granted: true, active: true, lastVerified: Date.now() },
        microphone: { granted: true, active: true, lastVerified: Date.now() },
        screen: { granted: true, active: true, lastVerified: Date.now() }
      });

      await securityManager.initialize();
      
      await expect(securityManager.initialize()).rejects.toThrow('SecurityManager already initialized');
    });
  });

  describe('getStatus', () => {
    beforeEach(() => {
      securityManager = new SecurityManager();
    });

    it('should return current security status', () => {
      const status = securityManager.getStatus();
      
      expect(status).toHaveProperty('overall');
      expect(status).toHaveProperty('permissions');
      expect(status).toHaveProperty('browserSecurity');
      expect(status).toHaveProperty('vmDetection');
      expect(status).toHaveProperty('systemIntegrity');
      expect(status).toHaveProperty('threats');
      expect(status).toHaveProperty('lastUpdated');
    });

    it('should return a copy of the status', () => {
      const status1 = securityManager.getStatus();
      const status2 = securityManager.getStatus();
      
      expect(status1).not.toBe(status2);
      expect(status1).toEqual(status2);
    });
  });

  describe('isSecure', () => {
    beforeEach(() => {
      securityManager = new SecurityManager();
    });

    it('should return true when overall status is secure', async () => {
      // Mock secure initialization
      mockVmDetector.detect.mockResolvedValue({
        isVirtualMachine: false,
        isEmulated: false,
        detectionMethods: [],
        confidence: 0,
        details: {}
      });

      mockBrowserSecurityDetector.performCheck.mockResolvedValue({
        developerToolsOpen: false,
        extensionsDetected: [],
        browserModifications: [],
        securityViolations: [],
        lastChecked: Date.now()
      });

      mockPermissionEnforcer.enforcePermissions.mockResolvedValue({
        camera: { granted: true, active: true, lastVerified: Date.now() },
        microphone: { granted: true, active: true, lastVerified: Date.now() },
        screen: { granted: true, active: true, lastVerified: Date.now() }
      });

      await securityManager.initialize();
      
      expect(securityManager.isSecure()).toBe(true);
    });

    it('should return false when there are threats', async () => {
      mockVmDetector.detect.mockResolvedValue({
        isVirtualMachine: true,
        isEmulated: false,
        detectionMethods: ['user_agent_analysis'],
        confidence: 0.8,
        details: {}
      });

      mockBrowserSecurityDetector.performCheck.mockResolvedValue({
        developerToolsOpen: false,
        extensionsDetected: [],
        browserModifications: [],
        securityViolations: [],
        lastChecked: Date.now()
      });

      mockPermissionEnforcer.enforcePermissions.mockResolvedValue({
        camera: { granted: true, active: true, lastVerified: Date.now() },
        microphone: { granted: true, active: true, lastVerified: Date.now() },
        screen: { granted: true, active: true, lastVerified: Date.now() }
      });

      await securityManager.initialize();
      
      expect(securityManager.isSecure()).toBe(false);
    });
  });

  describe('getActiveThreats', () => {
    beforeEach(() => {
      securityManager = new SecurityManager();
    });

    it('should return only unresolved threats', async () => {
      mockVmDetector.detect.mockResolvedValue({
        isVirtualMachine: true,
        isEmulated: false,
        detectionMethods: ['user_agent_analysis'],
        confidence: 0.8,
        details: {}
      });

      mockBrowserSecurityDetector.performCheck.mockResolvedValue({
        developerToolsOpen: false,
        extensionsDetected: [],
        browserModifications: [],
        securityViolations: [],
        lastChecked: Date.now()
      });

      mockPermissionEnforcer.enforcePermissions.mockResolvedValue({
        camera: { granted: true, active: true, lastVerified: Date.now() },
        microphone: { granted: true, active: true, lastVerified: Date.now() },
        screen: { granted: true, active: true, lastVerified: Date.now() }
      });

      await securityManager.initialize();
      
      const activeThreats = securityManager.getActiveThreats();
      expect(activeThreats).toHaveLength(1);
      expect(activeThreats[0].resolved).toBe(false);
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      securityManager = new SecurityManager();
    });

    it('should add and remove event listeners', () => {
      const handler = jest.fn();
      
      securityManager.addEventListener(handler);
      securityManager.removeEventListener(handler);
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should emit events when status changes', async () => {
      const handler = jest.fn();
      securityManager.addEventListener(handler);

      mockVmDetector.detect.mockResolvedValue({
        isVirtualMachine: false,
        isEmulated: false,
        detectionMethods: [],
        confidence: 0,
        details: {}
      });

      mockBrowserSecurityDetector.performCheck.mockResolvedValue({
        developerToolsOpen: false,
        extensionsDetected: [],
        browserModifications: [],
        securityViolations: [],
        lastChecked: Date.now()
      });

      mockPermissionEnforcer.enforcePermissions.mockResolvedValue({
        camera: { granted: true, active: true, lastVerified: Date.now() },
        microphone: { granted: true, active: true, lastVerified: Date.now() },
        screen: { granted: true, active: true, lastVerified: Date.now() }
      });

      await securityManager.initialize();
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status_changed',
          data: expect.any(Object),
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('recheckSecurity', () => {
    beforeEach(() => {
      securityManager = new SecurityManager();
    });

    it('should throw error if not initialized', async () => {
      await expect(securityManager.recheckSecurity()).rejects.toThrow('SecurityManager not initialized');
    });

    it('should perform security recheck when initialized', async () => {
      // Mock initialization
      mockVmDetector.detect.mockResolvedValue({
        isVirtualMachine: false,
        isEmulated: false,
        detectionMethods: [],
        confidence: 0,
        details: {}
      });

      mockBrowserSecurityDetector.performCheck.mockResolvedValue({
        developerToolsOpen: false,
        extensionsDetected: [],
        browserModifications: [],
        securityViolations: [],
        lastChecked: Date.now()
      });

      mockPermissionEnforcer.enforcePermissions.mockResolvedValue({
        camera: { granted: true, active: true, lastVerified: Date.now() },
        microphone: { granted: true, active: true, lastVerified: Date.now() },
        screen: { granted: true, active: true, lastVerified: Date.now() }
      });

      mockIntegrityMonitor.performCheck.mockResolvedValue({
        unauthorizedSoftware: [],
        screenRecordingDetected: false,
        remoteAccessDetected: false,
        suspiciousNetworkActivity: false,
        systemModifications: [],
        lastChecked: Date.now()
      });

      await securityManager.initialize();
      
      const status = await securityManager.recheckSecurity();
      
      expect(mockVmDetector.detect).toHaveBeenCalledTimes(2); // Once in init, once in recheck
      expect(mockBrowserSecurityDetector.performCheck).toHaveBeenCalledTimes(2);
      expect(mockIntegrityMonitor.performCheck).toHaveBeenCalledTimes(1); // Only in recheck
      expect(status).toHaveProperty('overall');
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      securityManager = new SecurityManager();
    });

    it('should cleanup all resources', () => {
      securityManager.destroy();
      
      expect(mockContinuousVerifier.stop).toHaveBeenCalled();
      expect(mockIntegrityMonitor.stop).toHaveBeenCalled();
      expect(mockBrowserSecurityDetector.stop).toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      securityManager.destroy();
      securityManager.destroy();
      
      // Should not throw
      expect(true).toBe(true);
    });
  });
});