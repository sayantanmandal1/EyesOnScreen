/**
 * Professional Quiz Component with Integrated Gaze Tracking
 * Example implementation showing how to use the professional gaze monitoring system
 */

import { useState, useEffect, useCallback } from 'react';
import { ProfessionalGazeMonitor } from '../monitoring/ProfessionalGazeMonitor';
import { professionalGazeMonitor } from '../../lib/professionalGazeMonitor';
import { gazeTracker } from '../../lib/gazeTracking';

export const ProfessionalQuizWithGazeTracking = ({
    questions = [],
    onQuizComplete = null,
    calibrationData = null
}) => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState({});
    const [quizStarted, setQuizStarted] = useState(false);
    const [gazeMonitoringActive, setGazeMonitoringActive] = useState(false);
    const [integrityAlerts, setIntegrityAlerts] = useState([]);
    const [quizMetrics, setQuizMetrics] = useState({
        startTime: null,
        eyesOffScreenEvents: 0,
        totalAlerts: 0,
        averageGazeConfidence: 0
    });

    // Initialize gaze tracking when component mounts
    useEffect(() => {
        const initializeGazeTracking = async () => {
            if (!gazeTracker.isReady()) {
                console.log('Gaze tracker not ready, initializing...');
                const success = await gazeTracker.start();
                if (!success) {
                    console.error('Failed to initialize gaze tracker for quiz');
                }
            }
        };

        initializeGazeTracking();
    }, []);

    // Start quiz and gaze monitoring
    const startQuiz = useCallback(async () => {
        if (!gazeTracker.isReady()) {
            alert('Gaze tracking system not ready. Please ensure camera is working and try again.');
            return;
        }

        // Validate calibration
        if (!calibrationData || !calibrationData.isValid) {
            alert('Valid calibration required before starting the quiz. Please complete calibration first.');
            return;
        }

        setQuizStarted(true);
        setGazeMonitoringActive(true);
        setQuizMetrics(prev => ({
            ...prev,
            startTime: Date.now()
        }));

        console.log('Professional quiz started with gaze monitoring');
    }, [calibrationData]);

    // Handle gaze monitoring alerts
    const handleGazeAlert = useCallback((alert) => {
        console.log('Gaze monitoring alert:', alert);

        setIntegrityAlerts(prev => [...prev, alert]);
        setQuizMetrics(prev => ({
            ...prev,
            totalAlerts: prev.totalAlerts + 1,
            eyesOffScreenEvents: alert.type === 'eyes_off_screen'
                ? prev.eyesOffScreenEvents + 1
                : prev.eyesOffScreenEvents
        }));

        // Handle different alert types
        switch (alert.type) {
            case 'eyes_off_screen':
                if (alert.duration > 5000) { // More than 5 seconds
                    showIntegrityWarning('Please keep your eyes on the screen during the exam.');
                }
                break;

            case 'high_risk_behavior':
                showIntegrityWarning('Suspicious behavior detected. Please focus on the exam questions.');
                break;

            case 'low_tracking_quality':
                showIntegrityWarning('Gaze tracking quality is poor. Please ensure good lighting and face visibility.');
                break;
        }
    }, []);

    const showIntegrityWarning = (message) => {
        // In a real implementation, this would show a modal or notification
        console.warn('Integrity Warning:', message);

        // Could also pause the quiz temporarily
        // setPaused(true);
    };

    // Handle answer selection
    const handleAnswerChange = (questionIndex, answer) => {
        setAnswers(prev => ({
            ...prev,
            [questionIndex]: answer
        }));
    };

    // Navigate to next question
    const nextQuestion = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
        } else {
            completeQuiz();
        }
    };

    // Complete quiz
    const completeQuiz = useCallback(() => {
        setGazeMonitoringActive(false);

        const endTime = Date.now();
        const duration = endTime - quizMetrics.startTime;

        // Get final monitoring report
        const monitoringReport = professionalGazeMonitor.getMonitoringReport();

        const finalResults = {
            answers,
            duration,
            integrityMetrics: {
                ...quizMetrics,
                endTime,
                monitoringReport,
                integrityAlerts,
                overallIntegrityScore: calculateIntegrityScore(monitoringReport, integrityAlerts)
            }
        };

        console.log('Professional quiz completed:', finalResults);

        if (onQuizComplete) {
            onQuizComplete(finalResults);
        }
    }, [answers, quizMetrics, integrityAlerts, onQuizComplete]);

    // Calculate integrity score based on monitoring data
    const calculateIntegrityScore = (monitoringReport, alerts) => {
        let score = 100;

        // Deduct points for alerts
        score -= alerts.length * 5;

        // Deduct points for poor gaze confidence
        if (monitoringReport.averageConfidence < 0.6) {
            score -= 20;
        }

        // Deduct points for excessive off-screen time
        const highSeverityAlerts = alerts.filter(a => a.severity === 'high').length;
        score -= highSeverityAlerts * 10;

        return Math.max(0, score);
    };

    // Pre-quiz screen
    if (!quizStarted) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="max-w-2xl mx-auto p-8">
                    <div className="bg-gray-800 rounded-xl p-8 border border-gray-600">
                        <h1 className="text-3xl font-bold text-white mb-6 text-center">
                            Professional Quiz Platform
                        </h1>

                        <div className="space-y-6">
                            {/* Calibration status */}
                            <div className="bg-gray-700 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-white mb-3">Gaze Tracking Status</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300">Camera Access:</span>
                                        <span className={`px-2 py-1 rounded text-sm ${gazeTracker.isReady() ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                                            }`}>
                                            {gazeTracker.isReady() ? 'Ready' : 'Not Ready'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300">Calibration:</span>
                                        <span className={`px-2 py-1 rounded text-sm ${calibrationData?.isValid ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                                            }`}>
                                            {calibrationData?.isValid ? 'Valid' : 'Required'}
                                        </span>
                                    </div>
                                    {calibrationData?.quality && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-300">Quality:</span>
                                            <span className="text-gray-300">
                                                {Math.round(calibrationData.quality * 100)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quiz information */}
                            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-blue-300 mb-2">Quiz Information</h3>
                                <ul className="text-gray-300 space-y-1">
                                    <li>• {questions.length} questions</li>
                                    <li>• Professional gaze monitoring active</li>
                                    <li>• Integrity alerts will be recorded</li>
                                    <li>• Keep your eyes on the screen at all times</li>
                                </ul>
                            </div>

                            {/* Start button */}
                            <button
                                onClick={startQuiz}
                                disabled={!gazeTracker.isReady() || !calibrationData?.isValid}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-lg font-semibold transition-colors"
                            >
                                {!gazeTracker.isReady() ? 'Waiting for Camera...' :
                                    !calibrationData?.isValid ? 'Calibration Required' :
                                        'Start Professional Quiz'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Quiz interface
    const question = questions[currentQuestion];

    return (
        <div className="min-h-screen bg-gray-900 relative">
            {/* Professional Gaze Monitor */}
            <ProfessionalGazeMonitor
                isActive={gazeMonitoringActive}
                onAlert={handleGazeAlert}
                showDetailedMetrics={true}
                position="top-right"
            />

            {/* Quiz content */}
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    {/* Quiz header */}
                    <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-600">
                        <div className="flex justify-between items-center">
                            <h1 className="text-2xl font-bold text-white">
                                Professional Quiz
                            </h1>
                            <div className="text-gray-300">
                                Question {currentQuestion + 1} of {questions.length}
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-4 w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Question */}
                    {question && (
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-600">
                            <h2 className="text-xl font-semibold text-white mb-6">
                                {question.question}
                            </h2>

                            {/* Answer options */}
                            <div className="space-y-3 mb-6">
                                {question.options?.map((option, index) => (
                                    <label
                                        key={index}
                                        className="flex items-center p-3 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="radio"
                                            name={`question-${currentQuestion}`}
                                            value={option}
                                            checked={answers[currentQuestion] === option}
                                            onChange={(e) => handleAnswerChange(currentQuestion, e.target.value)}
                                            className="mr-3"
                                        />
                                        <span className="text-gray-300">{option}</span>
                                    </label>
                                ))}
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-between">
                                <button
                                    onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                                    disabled={currentQuestion === 0}
                                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                >
                                    Previous
                                </button>

                                <button
                                    onClick={nextQuestion}
                                    disabled={!answers[currentQuestion]}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                >
                                    {currentQuestion === questions.length - 1 ? 'Complete Quiz' : 'Next Question'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Integrity status */}
                    {integrityAlerts.length > 0 && (
                        <div className="mt-6 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                            <h3 className="text-yellow-300 font-semibold mb-2">Integrity Monitoring</h3>
                            <p className="text-yellow-200 text-sm">
                                {integrityAlerts.length} integrity event(s) detected during this quiz.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfessionalQuizWithGazeTracking;