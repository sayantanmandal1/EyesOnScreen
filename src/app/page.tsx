'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { QuizInterface } from '../components/quiz/QuizInterface';
import { EnhancedCalibrationWizard } from '../components/calibration/EnhancedCalibrationWizard';
import { MonitoringStatusDisplay } from '../components/monitoring/MonitoringStatusDisplay';
import { ConsentModal } from '../components/ui/ConsentModal';
import { CameraPermissionModal } from '../components/ui/CameraPermissionModal';
import { AlertManager } from '../components/ui/AlertManager';
import { ToastContainer } from '../components/ui/ToastContainer';
import { SAMPLE_QUESTION_BANK } from '../lib/quiz/QuestionBank';
import { Question, QuizSession } from '../lib/quiz/types';

export default function Home() {
  const { 
    session, 
    setSession, 
    calibrationStep, 
    setQuizPhase,
    showAlert,
    hideAlert 
  } = useAppStore();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isConsentGiven, setIsConsentGiven] = useState(false);
  const [isCameraPermissionGranted, setIsCameraPermissionGranted] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  // Initialize questions
  useEffect(() => {
    setQuestions(SAMPLE_QUESTION_BANK.slice(0, 5)); // Get first 5 sample questions
  }, []);

  // Handle quiz completion
  const handleQuizComplete = (results: any) => {
    console.log('Quiz completed:', results);
    showAlert('soft', 'Quiz completed successfully!');
    // Reset session for new quiz
    setSession(null);
    setQuizPhase('consent');
  };

  // Handle quiz cancellation
  const handleQuizCancel = () => {
    if (confirm('Are you sure you want to cancel the quiz? All progress will be lost.')) {
      setSession(null);
      setQuizPhase('consent');
      showAlert('soft', 'Quiz cancelled');
    }
  };

  // Handle consent
  const handleConsent = () => {
    setIsConsentGiven(true);
    hideAlert();
  };

  // Handle camera permission
  const handleCameraPermission = () => {
    setIsCameraPermissionGranted(true);
    hideAlert();
  };

  // Check if app is ready
  useEffect(() => {
    if (questions.length > 0 && isConsentGiven && isCameraPermissionGranted) {
      setIsAppReady(true);
    }
  }, [questions, isConsentGiven, isCameraPermissionGranted]);

  // Show consent modal if not given
  if (!isConsentGiven) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ConsentModal 
          isOpen={true}
          onAccept={handleConsent}
          onDecline={() => window.close()}
        />
      </div>
    );
  }

  // Show camera permission modal if not granted
  if (!isCameraPermissionGranted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <CameraPermissionModal 
          isOpen={true}
          onPermissionGranted={handleCameraPermission}
          onPermissionDenied={() => window.close()}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with monitoring status */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              Eyes on Screen Quiz
            </h1>
            <MonitoringStatusDisplay />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isAppReady ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Initializing application...</p>
          </div>
        ) : calibrationStep < 3 ? (
          // Calibration phase
          <div className="max-w-4xl mx-auto">
            <EnhancedCalibrationWizard 
              onComplete={() => setQuizPhase('quiz')}
              onCancel={() => setQuizPhase('consent')}
            />
          </div>
        ) : session ? (
          // Quiz phase
          <div className="max-w-4xl mx-auto">
            <QuizInterface
              questions={questions}
              onComplete={handleQuizComplete}
              onCancel={handleQuizCancel}
            />
          </div>
        ) : (
          // Start quiz button
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to Start Quiz
            </h2>
            <p className="text-gray-600 mb-8">
              You have completed calibration. Click the button below to begin your quiz.
            </p>
            <button
              onClick={() => {
                const newSession: QuizSession = {
                  id: 'new-session',
                  questions: questions,
                  answers: {},
                  startTime: Date.now(),
                  currentQuestionIndex: 0,
                  flags: [],
                  riskScore: 0,
                  status: 'not-started'
                };
                setSession(newSession);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors"
            >
              Start Quiz
            </button>
          </div>
        )}
      </main>

      {/* Global components */}
      <AlertManager config={{
        debouncing: {
          softAlertFrames: 8,
          hardAlertFrames: 5,
          gracePeriodMs: 500
        },
        audio: {
          enabled: true,
          softAlertVolume: 0.3,
          hardAlertVolume: 0.7
        },
        toast: {
          duration: 3000,
          maxVisible: 3
        }
      }} />
      <ToastContainer alerts={[]} onDismiss={() => {}} />
    </div>
  );
}
