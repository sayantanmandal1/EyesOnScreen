import { useAppStore } from '../appStore';
import { VisionSignals, FlagEvent, CalibrationProfile } from '../types';

// Mock Zustand
jest.mock('zustand', () => ({
  create: (fn: any) => {
    const store = fn(() => ({}), () => ({}));
    return () => store;
  }
}));

describe('AppStore', () => {
  let store: ReturnType<typeof useAppStore>;

  beforeEach(() => {
    store = useAppStore();
    // Reset store state
    store.session = null;
    store.calibrationProfile = null;
    store.currentSignals = null;
    store.activeFlags = [];
    store.riskScore = 0;
    store.cameraPermission = 'pending';
    store.calibrationStep = 0;
    store.quizPhase = 'consent';
    store.alertModal = null;
    store.privacySettings = {
      videoPreviewEnabled: true,
      serverSyncEnabled: false,
      audioAlertsEnabled: true
    };
  });

  describe('session management', () => {
    it('should initialize session', () => {
      const sessionData = {
        id: 'test-session',
        questions: [],
        answers: {},
        startTime: Date.now(),
        currentQuestionIndex: 0,
        flags: [],
        riskScore: 0,
        status: 'not-started' as const
      };

      store.setSession(sessionData);

      expect(store.session).toEqual(sessionData);
    });

    it('should update session answers', () => {
      const sessionData = {
        id: 'test-session',
        questions: [],
        answers: {},
        startTime: Date.now(),
        currentQuestionIndex: 0,
        flags: [],
        riskScore: 0,
        status: 'in-progress' as const
      };

      store.setSession(sessionData);
      store.updateAnswer('q1', 'answer1');

      expect(store.session?.answers['q1']).toBe('answer1');
    });

    it('should advance to next question', () => {
      const sessionData = {
        id: 'test-session',
        questions: [
          { id: 'q1', type: 'multiple-choice' as const, text: 'Q1', options: ['A', 'B'], correctAnswer: 'A', timeLimitSeconds: 30, points: 1 },
          { id: 'q2', type: 'multiple-choice' as const, text: 'Q2', options: ['A', 'B'], correctAnswer: 'B', timeLimitSeconds: 30, points: 1 }
        ],
        answers: {},
        startTime: Date.now(),
        currentQuestionIndex: 0,
        flags: [],
        riskScore: 0,
        status: 'in-progress' as const
      };

      store.setSession(sessionData);
      store.nextQuestion();

      expect(store.session?.currentQuestionIndex).toBe(1);
    });

    it('should not advance beyond last question', () => {
      const sessionData = {
        id: 'test-session',
        questions: [
          { id: 'q1', type: 'multiple-choice' as const, text: 'Q1', options: ['A', 'B'], correctAnswer: 'A', timeLimitSeconds: 30, points: 1 }
        ],
        answers: {},
        startTime: Date.now(),
        currentQuestionIndex: 0,
        flags: [],
        riskScore: 0,
        status: 'in-progress' as const
      };

      store.setSession(sessionData);
      store.nextQuestion();

      expect(store.session?.currentQuestionIndex).toBe(0);
    });
  });

  describe('calibration management', () => {
    it('should set calibration profile', () => {
      const profile: CalibrationProfile = {
        ipd: 65,
        earBaseline: 0.3,
        gazeMapping: {
          homography: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
          bias: [0, 0]
        },
        headPoseBounds: {
          yawRange: [-20, 20],
          pitchRange: [-15, 15]
        },
        lightingBaseline: {
          histogram: new Array(256).fill(0),
          mean: 128,
          variance: 10
        },
        quality: 0.9,
        timestamp: Date.now()
      };

      store.setCalibrationProfile(profile);

      expect(store.calibrationProfile).toEqual(profile);
    });

    it('should advance calibration step', () => {
      store.nextCalibrationStep();
      expect(store.calibrationStep).toBe(1);
    });

    it('should reset calibration step', () => {
      store.calibrationStep = 5;
      store.resetCalibration();
      expect(store.calibrationStep).toBe(0);
    });
  });

  describe('monitoring signals', () => {
    it('should update current signals', () => {
      const signals: VisionSignals = {
        timestamp: Date.now(),
        faceDetected: true,
        landmarks: new Float32Array(468 * 3),
        headPose: {
          yaw: 5,
          pitch: -2,
          roll: 1,
          confidence: 0.9
        },
        gazeVector: {
          x: 0.1,
          y: -0.05,
          z: -1,
          confidence: 0.85
        },
        eyesOnScreen: true,
        environmentScore: {
          lighting: 0.8,
          shadowStability: 0.9,
          secondaryFaces: 0,
          deviceLikeObjects: 0
        }
      };

      store.updateSignals(signals);

      expect(store.currentSignals).toEqual(signals);
    });

    it('should add flag event', () => {
      const flag: FlagEvent = {
        id: 'flag-1',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.8,
        details: {}
      };

      store.addFlag(flag);

      expect(store.activeFlags).toContain(flag);
    });

    it('should remove flag event', () => {
      const flag: FlagEvent = {
        id: 'flag-1',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.8,
        details: {}
      };

      store.addFlag(flag);
      store.removeFlag('flag-1');

      expect(store.activeFlags).not.toContain(flag);
    });

    it('should update risk score', () => {
      store.updateRiskScore(25);
      expect(store.riskScore).toBe(25);

      store.updateRiskScore(-10);
      expect(store.riskScore).toBe(15);
    });

    it('should not allow negative risk score', () => {
      store.updateRiskScore(-50);
      expect(store.riskScore).toBe(0);
    });

    it('should cap risk score at 100', () => {
      store.updateRiskScore(150);
      expect(store.riskScore).toBe(100);
    });
  });

  describe('UI state management', () => {
    it('should update camera permission', () => {
      store.setCameraPermission('granted');
      expect(store.cameraPermission).toBe('granted');
    });

    it('should update quiz phase', () => {
      store.setQuizPhase('calibration');
      expect(store.quizPhase).toBe('calibration');
    });

    it('should show alert modal', () => {
      const alert = {
        visible: true,
        type: 'warning',
        message: 'Test alert'
      };

      store.showAlert(alert.type, alert.message);

      expect(store.alertModal).toEqual(alert);
    });

    it('should hide alert modal', () => {
      store.showAlert('info', 'Test');
      store.hideAlert();

      expect(store.alertModal).toBeNull();
    });
  });

  describe('privacy settings', () => {
    it('should update video preview setting', () => {
      store.setVideoPreviewEnabled(false);
      expect(store.privacySettings.videoPreviewEnabled).toBe(false);
    });

    it('should update server sync setting', () => {
      store.setServerSyncEnabled(true);
      expect(store.privacySettings.serverSyncEnabled).toBe(true);
    });

    it('should update audio alerts setting', () => {
      store.setAudioAlertsEnabled(false);
      expect(store.privacySettings.audioAlertsEnabled).toBe(false);
    });
  });

  describe('computed values', () => {
    it('should calculate current question', () => {
      const sessionData = {
        id: 'test-session',
        questions: [
          { id: 'q1', type: 'multiple-choice' as const, text: 'Q1', options: ['A', 'B'], correctAnswer: 'A', timeLimitSeconds: 30, points: 1 },
          { id: 'q2', type: 'multiple-choice' as const, text: 'Q2', options: ['A', 'B'], correctAnswer: 'B', timeLimitSeconds: 30, points: 1 }
        ],
        answers: {},
        startTime: Date.now(),
        currentQuestionIndex: 1,
        flags: [],
        riskScore: 0,
        status: 'in-progress' as const
      };

      store.setSession(sessionData);

      expect(store.getCurrentQuestion()).toEqual(sessionData.questions[1]);
    });

    it('should return null for current question when no session', () => {
      expect(store.getCurrentQuestion()).toBeNull();
    });

    it('should check if quiz is complete', () => {
      const sessionData = {
        id: 'test-session',
        questions: [
          { id: 'q1', type: 'multiple-choice' as const, text: 'Q1', options: ['A', 'B'], correctAnswer: 'A', timeLimitSeconds: 30, points: 1 }
        ],
        answers: { q1: 'A' },
        startTime: Date.now(),
        currentQuestionIndex: 0,
        flags: [],
        riskScore: 0,
        status: 'completed' as const
      };

      store.setSession(sessionData);

      expect(store.isQuizComplete()).toBe(true);
    });

    it('should get monitoring status', () => {
      const signals: VisionSignals = {
        timestamp: Date.now(),
        faceDetected: true,
        landmarks: new Float32Array(468 * 3),
        headPose: {
          yaw: 5,
          pitch: -2,
          roll: 1,
          confidence: 0.9
        },
        gazeVector: {
          x: 0.1,
          y: -0.05,
          z: -1,
          confidence: 0.85
        },
        eyesOnScreen: true,
        environmentScore: {
          lighting: 0.8,
          shadowStability: 0.9,
          secondaryFaces: 0,
          deviceLikeObjects: 0
        }
      };

      store.updateSignals(signals);

      const status = store.getMonitoringStatus();

      expect(status.eyesOnScreen).toBe(true);
      expect(status.headPoseGood).toBe(true);
      expect(status.environmentStable).toBe(true);
    });
  });
});