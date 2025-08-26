/**
 * Application constants
 * Converted from TypeScript to JavaScript
 */

export const VISION_CONSTANTS = {
  // MediaPipe FaceMesh
  FACE_LANDMARKS_COUNT: 468,
  IRIS_LANDMARKS: {
    LEFT_CENTER: 468,
    RIGHT_CENTER: 473,
  },
  
  // Processing
  TARGET_FPS: 30,
  MIN_FPS: 15,
  MAX_PROCESSING_TIME_MS: 33, // ~30 FPS
  
  // Confidence thresholds
  MIN_FACE_CONFIDENCE: 0.5,
  MIN_GAZE_CONFIDENCE: 0.7,
  MIN_HEAD_POSE_CONFIDENCE: 0.6,
};

export const CALIBRATION_CONSTANTS = {
  // Calibration points
  GAZE_POINTS_COUNT: 9,
  CALIBRATION_DURATION_MS: 45000, // 45 seconds
  POINT_DISPLAY_DURATION_MS: 3000, // 3 seconds per point
  
  // Quality thresholds
  MIN_CALIBRATION_QUALITY: 0.8,
  MAX_REPROJECTION_ERROR: 2.0, // pixels
  
  // Head pose bounds (degrees)
  DEFAULT_YAW_RANGE: [-25, 25],
  DEFAULT_PITCH_RANGE: [-20, 20],
};

export const PROCTORING_CONSTANTS = {
  // Alert thresholds
  EYES_OFF_DURATION_MS: 600,
  SHADOW_ANOMALY_DURATION_MS: 800,
  FACE_MISSING_DURATION_MS: 1000,
  
  // Debouncing
  SOFT_ALERT_FRAMES: 10,
  HARD_ALERT_FRAMES: 5,
  GRACE_PERIOD_MS: 500,
  
  // Risk scoring
  RISK_SCORE_MAX: 100,
  REVIEW_THRESHOLD: 60,
  EYES_OFF_PENALTY: 3,
  HARD_EVENT_PENALTY: 25,
  SCORE_DECAY_PER_SECOND: 1,
};

export const QUIZ_CONSTANTS = {
  // Quiz configuration
  TOTAL_QUESTIONS: 10,
  MULTIPLE_CHOICE_COUNT: 7,
  SHORT_ANSWER_COUNT: 3,
  TIME_PER_QUESTION_SECONDS: 25,
  TOTAL_TIME_MINUTES: 5,
  
  // Integrity
  MAX_TAB_BLUR_COUNT: 3,
  MAX_FULLSCREEN_EXIT_COUNT: 2,
  
  // Accessibility
  FOCUS_OUTLINE_WIDTH: 2,
  MIN_CONTRAST_RATIO: 4.5,
};

export const PERFORMANCE_CONSTANTS = {
  // Performance targets
  TARGET_FPS: 30,
  MIN_FPS: 24,
  MAX_CPU_USAGE: 60, // percentage
  MAX_MEMORY_USAGE_MB: 300,
  
  // Monitoring intervals
  PERFORMANCE_CHECK_INTERVAL_MS: 1000,
  MEMORY_CHECK_INTERVAL_MS: 5000,
  
  // Adaptive quality
  FPS_DROP_THRESHOLD: 5,
  QUALITY_ADJUSTMENT_STEPS: 3,
};

export const STORAGE_CONSTANTS = {
  // IndexedDB
  DB_NAME: 'EyesOnScreenQuiz',
  DB_VERSION: 1,
  
  // Storage limits
  MAX_LOG_ENTRIES: 10000,
  MAX_SESSION_HISTORY: 50,
  RETENTION_DAYS: 30,
  
  // Compression
  COMPRESSION_THRESHOLD_BYTES: 1024,
  BATCH_SIZE: 100,
};

export const UI_CONSTANTS = {
  // Animation durations
  ALERT_DURATION_MS: 3000,
  MODAL_ANIMATION_MS: 200,
  TRANSITION_DURATION_MS: 150,
  
  // Breakpoints
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
  DESKTOP_BREAKPOINT: 1280,
  
  // Colors (Tailwind classes)
  COLORS: {
    SUCCESS: 'green-500',
    WARNING: 'yellow-500',
    ERROR: 'red-500',
    INFO: 'blue-500',
    PRIMARY: 'indigo-600',
  },
};

export const ERROR_MESSAGES = {
  CAMERA: {
    PERMISSION_DENIED: 'Camera permission is required to proceed with the quiz.',
    NOT_FOUND: 'No camera device found. Please connect a camera and try again.',
    NOT_READABLE: 'Camera is being used by another application. Please close other applications and try again.',
    OVERCONSTRAINED: 'Camera does not support the required resolution. Please try a different camera.',
  },
  VISION: {
    MODEL_LOAD_FAILED: 'Failed to load vision processing models. Please refresh and try again.',
    FACE_DETECTION_FAILED: 'Unable to detect face consistently. Please ensure good lighting and face visibility.',
    CALIBRATION_FAILED: 'Calibration failed. Please try again with better lighting and stable head position.',
  },
  QUIZ: {
    SESSION_EXPIRED: 'Quiz session has expired. Please start a new session.',
    NETWORK_ERROR: 'Network error occurred. Your progress has been saved locally.',
    INTEGRITY_VIOLATION: 'Academic integrity violation detected. Please follow the quiz guidelines.',
  },
};