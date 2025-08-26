/**
 * Main application store using Zustand
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { AppStore } from './types';
// Removed unused import

const initialState = {
  // Session state
  session: null,
  calibrationProfile: null,
  calibrationSession: null,
  
  // Real-time monitoring
  monitoring: {
    isActive: false,
    currentSignals: null,
    activeFlags: [],
    riskScore: 0,
    performanceMetrics: {
      fps: 0,
      latency: 0,
      memoryUsage: 0,
    },
  },
  currentSignals: null,
  activeFlags: [],
  riskScore: 0,
  
  // UI state
  cameraPermission: 'pending' as const,
  calibrationStep: 0,
  quizPhase: 'consent' as const,
  alertModal: null,
  
  // Settings
  privacySettings: {
    videoPreviewEnabled: true,
    serverSyncEnabled: false,
    audioAlertsEnabled: true,
    dataRetentionDays: 30,
  },
  
  // Performance
  performanceMetrics: {
    fps: 0,
    latency: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    droppedFrames: 0,
  },
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        // Session actions
        setSession: (session) => set({ session }),
        
        setCalibrationProfile: (calibrationProfile) => set({ calibrationProfile }),
        
        setCalibrationSession: (calibrationSession) => set({ calibrationSession }),
        
        // Monitoring actions
        updateSignals: (signals) => set({ 
          currentSignals: signals,
          monitoring: {
            ...get().monitoring,
            currentSignals: signals,
          },
        }),
        
        addFlag: (flag) => set((state) => ({
          activeFlags: [...state.activeFlags, flag],
          monitoring: {
            ...state.monitoring,
            activeFlags: [...state.monitoring.activeFlags, flag],
          },
        })),
        
        updateRiskScore: (delta) => set((state) => ({
          riskScore: Math.max(0, Math.min(100, state.riskScore + delta)),
          monitoring: {
            ...state.monitoring,
            riskScore: Math.max(0, Math.min(100, state.monitoring.riskScore + delta)),
          },
        })),
        
        setMonitoringActive: (active) => set((state) => ({
          monitoring: {
            ...state.monitoring,
            isActive: active,
          },
        })),
        
        // UI actions
        setCameraPermission: (cameraPermission) => set((state) => ({
          cameraPermission,
          // Automatically set monitoring active when camera is granted
          monitoring: {
            ...state.monitoring,
            isActive: cameraPermission === 'granted'
          }
        })),
        
        setQuizPhase: (quizPhase) => set({ quizPhase }),
        
        showAlert: (type, message) => set({
          alertModal: {
            visible: true,
            type,
            message,
            timestamp: Date.now(),
          },
        }),
        
        hideAlert: () => set({ alertModal: null }),
        
        // Settings actions
        updatePrivacySettings: (settings) => set((state) => ({
          privacySettings: {
            ...state.privacySettings,
            ...settings,
          },
        })),
        
        // Performance actions
        updatePerformanceMetrics: (metrics) => set((state) => ({
          performanceMetrics: {
            ...state.performanceMetrics,
            ...metrics,
          },
          monitoring: {
            ...state.monitoring,
            performanceMetrics: {
              ...state.monitoring.performanceMetrics,
              fps: metrics.fps ?? state.monitoring.performanceMetrics.fps,
              latency: metrics.latency ?? state.monitoring.performanceMetrics.latency,
              memoryUsage: metrics.memoryUsage ?? state.monitoring.performanceMetrics.memoryUsage,
            },
          },
        })),
        
        // Reset actions
        resetSession: () => set({
          session: null,
          activeFlags: [],
          riskScore: 0,
          quizPhase: 'consent',
          alertModal: null,
        }),
        
        resetCalibration: () => set({
          calibrationProfile: null,
          calibrationSession: null,
          calibrationStep: 0,
        }),
        
        resetAll: () => set({
          ...initialState,
          privacySettings: get().privacySettings, // Preserve privacy settings
        }),
      }),
      {
        name: 'eyes-on-screen-quiz-store',
        partialize: (state) => ({
          // Only persist certain parts of the state
          calibrationProfile: state.calibrationProfile,
          privacySettings: state.privacySettings,
        }),
      }
    ),
    {
      name: 'eyes-on-screen-quiz',
    }
  )
);