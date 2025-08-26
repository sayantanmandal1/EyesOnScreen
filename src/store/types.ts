/**
 * Store type definitions
 */

import { VisionSignals, CalibrationProfile } from '../lib/vision/types';
import { FlagEvent, MonitoringState } from '../lib/proctoring/types';
import { QuizSession } from '../lib/quiz/types';
import { CalibrationSession } from '../lib/calibration/types';

export interface AppState {
  // Session state
  session: QuizSession | null;
  calibrationProfile: CalibrationProfile | null;
  calibrationSession: CalibrationSession | null;
  
  // Real-time monitoring
  monitoring: MonitoringState;
  currentSignals: VisionSignals | null;
  activeFlags: FlagEvent[];
  riskScore: number;
  
  // UI state
  cameraPermission: 'pending' | 'granted' | 'denied';
  calibrationStep: number;
  quizPhase: 'consent' | 'calibration' | 'environment-check' | 'quiz' | 'results';
  alertModal: { 
    visible: boolean; 
    type: 'soft' | 'hard'; 
    message: string;
    timestamp: number;
  } | null;
  
  // Settings
  privacySettings: {
    videoPreviewEnabled: boolean;
    serverSyncEnabled: boolean;
    audioAlertsEnabled: boolean;
    dataRetentionDays: number;
  };
  
  // Performance
  performanceMetrics: {
    fps: number;
    latency: number;
    memoryUsage: number;
    cpuUsage: number;
    droppedFrames: number;
  };
}

export interface AppActions {
  // Session actions
  setSession: (session: QuizSession | null) => void;
  setCalibrationProfile: (profile: CalibrationProfile | null) => void;
  setCalibrationSession: (session: CalibrationSession | null) => void;
  
  // Monitoring actions
  updateSignals: (signals: VisionSignals) => void;
  addFlag: (flag: FlagEvent) => void;
  updateRiskScore: (delta: number) => void;
  setMonitoringActive: (active: boolean) => void;
  
  // UI actions
  setCameraPermission: (permission: 'pending' | 'granted' | 'denied') => void;
  setQuizPhase: (phase: AppState['quizPhase']) => void;
  showAlert: (type: 'soft' | 'hard', message: string) => void;
  hideAlert: () => void;
  
  // Settings actions
  updatePrivacySettings: (settings: Partial<AppState['privacySettings']>) => void;
  
  // Performance actions
  updatePerformanceMetrics: (metrics: Partial<AppState['performanceMetrics']>) => void;
  
  // Reset actions
  resetSession: () => void;
  resetCalibration: () => void;
  resetAll: () => void;
}

export type AppStore = AppState & AppActions;