/**
 * Quiz results summary with risk score display
 */

import React, { useState } from 'react';
import { QuizSession } from '../../lib/quiz/types';
import { FlagEvent } from '../../lib/proctoring/types';

interface QuizResultsSummaryProps {
  session: QuizSession;
  flags: FlagEvent[];
  riskScore: number;
  className?: string;
  showDetailedBreakdown?: boolean;
}

export const QuizResultsSummary: React.FC<QuizResultsSummaryProps> = ({
  session,
  flags,
  riskScore,
  className = '',
  showDetailedBreakdown = true
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Calculate quiz statistics
  const totalQuestions = session.questions.length;
  const answeredQuestions = Object.keys(session.answers).length;
  const completionRate = (answeredQuestions / totalQuestions) * 100;
  const quizDuration = session.endTime ? session.endTime - session.startTime : 0;
  const averageTimePerQuestion = quizDuration / totalQuestions;

  // Calculate score if correct answers are available
  const correctAnswers = session.questions.filter(q => 
    session.answers[q.id] && session.answers[q.id] === q.correctAnswer
  ).length;
  const scorePercentage = (correctAnswers / totalQuestions) * 100;

  // Risk assessment
  const getRiskLevel = (score: number) => {
    if (score >= 70) return { level: 'High', color: 'text-red-600 bg-red-50 border-red-200' };
    if (score >= 40) return { level: 'Medium', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    if (score >= 20) return { level: 'Low', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    return { level: 'Minimal', color: 'text-green-600 bg-green-50 border-green-200' };
  };

  const riskAssessment = getRiskLevel(riskScore);

  // Flag categorization
  const flagsByType = flags.reduce((acc, flag) => {
    acc[flag.type] = (acc[flag.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const flagCategories = [
    { type: 'EYES_OFF', label: 'Eyes Off Screen', icon: '👀' },
    { type: 'HEAD_POSE', label: 'Head Position', icon: '🔄' },
    { type: 'TAB_BLUR', label: 'Tab Changes', icon: '🪟' },
    { type: 'SECOND_FACE', label: 'Additional People', icon: '👥' },
    { type: 'DEVICE_OBJECT', label: 'Unauthorized Devices', icon: '📱' },
    { type: 'SHADOW_ANOMALY', label: 'Lighting Changes', icon: '💡' },
    { type: 'FACE_MISSING', label: 'Face Not Detected', icon: '❓' },
    { type: 'DOWN_GLANCE', label: 'Downward Glances', icon: '👇' }
  ];

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            Quiz Results Summary
          </h2>
          <div className="text-sm text-gray-500">
            {new Date(session.startTime).toLocaleString()}
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="mt-4 flex items-center space-x-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            session.status === 'completed' 
              ? 'bg-green-100 text-green-800'
              : session.status === 'under-review'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {session.status === 'completed' ? 'Completed' : 
             session.status === 'under-review' ? 'Under Review' : 
             'In Progress'}
          </div>
          
          <div className={`px-3 py-1 rounded-full text-sm font-medium border ${riskAssessment.color}`}>
            {riskAssessment.level} Risk ({riskScore}/100)
          </div>
        </div>
      </div>

      {/* Main statistics */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Quiz Score */}
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {Math.round(scorePercentage)}%
            </div>
            <div className="text-sm text-gray-600">Quiz Score</div>
            <div className="text-xs text-gray-500 mt-1">
              {correctAnswers}/{totalQuestions} correct
            </div>
          </div>

          {/* Completion Rate */}
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {Math.round(completionRate)}%
            </div>
            <div className="text-sm text-gray-600">Completion</div>
            <div className="text-xs text-gray-500 mt-1">
              {answeredQuestions}/{totalQuestions} answered
            </div>
          </div>

          {/* Duration */}
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {Math.round(quizDuration / 60000)}m
            </div>
            <div className="text-sm text-gray-600">Duration</div>
            <div className="text-xs text-gray-500 mt-1">
              {Math.round(averageTimePerQuestion / 1000)}s avg/question
            </div>
          </div>

          {/* Flags */}
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 mb-1">
              {flags.length}
            </div>
            <div className="text-sm text-gray-600">Integrity Flags</div>
            <div className="text-xs text-gray-500 mt-1">
              {flags.filter(f => f.severity === 'hard').length} major
            </div>
          </div>
        </div>

        {/* Risk Score Breakdown */}
        <div className="mb-8">
          <button
            onClick={() => toggleSection('risk-breakdown')}
            className="flex items-center justify-between w-full p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-lg font-semibold text-gray-900">
              Risk Score Breakdown
            </h3>
            <svg 
              className={`w-5 h-5 text-gray-500 transition-transform ${
                expandedSection === 'risk-breakdown' ? 'rotate-180' : ''
              }`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSection === 'risk-breakdown' && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg">
              <div className="space-y-4">
                {/* Risk score visualization */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall Risk Score</span>
                    <span className="text-sm text-gray-600">{riskScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        riskScore >= 70 ? 'bg-red-500' :
                        riskScore >= 40 ? 'bg-yellow-500' :
                        riskScore >= 20 ? 'bg-blue-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(riskScore, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Risk factors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Contributing Factors:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Eyes off screen: {flags.filter(f => f.type === 'EYES_OFF').length} incidents</li>
                      <li>• Tab changes: {flags.filter(f => f.type === 'TAB_BLUR').length} incidents</li>
                      <li>• Head movement: {flags.filter(f => f.type === 'HEAD_POSE').length} incidents</li>
                      <li>• Environment changes: {flags.filter(f => f.type === 'SHADOW_ANOMALY').length} incidents</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Risk Assessment:</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Level: <span className="font-medium">{riskAssessment.level}</span></div>
                      <div>Recommendation: {
                        riskScore >= 70 ? 'Manual review required' :
                        riskScore >= 40 ? 'Additional verification recommended' :
                        riskScore >= 20 ? 'Minor concerns noted' :
                        'No significant concerns'
                      }</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Flag Summary */}
        {flags.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => toggleSection('flag-summary')}
              className="flex items-center justify-between w-full p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <h3 className="text-lg font-semibold text-gray-900">
                Integrity Flags ({flags.length})
              </h3>
              <svg 
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  expandedSection === 'flag-summary' ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSection === 'flag-summary' && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {flagCategories.map(category => {
                    const count = flagsByType[category.type] || 0;
                    if (count === 0) return null;
                    
                    return (
                      <div key={category.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{category.icon}</span>
                          <div>
                            <div className="font-medium text-gray-900">{category.label}</div>
                            <div className="text-sm text-gray-600">{count} incident{count !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className="text-lg font-bold text-gray-700">
                          {count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detailed Performance */}
        {showDetailedBreakdown && (
          <div>
            <button
              onClick={() => toggleSection('performance')}
              className="flex items-center justify-between w-full p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <h3 className="text-lg font-semibold text-gray-900">
                Detailed Performance
              </h3>
              <svg 
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  expandedSection === 'performance' ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSection === 'performance' && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                <div className="space-y-4">
                  {session.questions.map((question, index) => {
                    const userAnswer = session.answers[question.id];
                    const isCorrect = userAnswer === question.correctAnswer;
                    const questionFlags = flags.filter(f => f.questionId === question.id);
                    
                    return (
                      <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            Question {index + 1}
                          </h4>
                          <div className="flex items-center space-x-2">
                            {isCorrect ? (
                              <span className="text-green-600 text-sm">✓ Correct</span>
                            ) : (
                              <span className="text-red-600 text-sm">✗ Incorrect</span>
                            )}
                            {questionFlags.length > 0 && (
                              <span className="text-yellow-600 text-sm">
                                ⚠ {questionFlags.length} flag{questionFlags.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-2">
                          {question.text}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <strong>Your answer:</strong> {userAnswer || 'No answer'}
                          </div>
                          <div>
                            <strong>Correct answer:</strong> {question.correctAnswer}
                          </div>
                        </div>
                        
                        {questionFlags.length > 0 && (
                          <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                            <div className="text-sm text-yellow-800">
                              <strong>Flags for this question:</strong>
                              <ul className="mt-1 space-y-1">
                                {questionFlags.map(flag => (
                                  <li key={flag.id}>
                                    • {flag.type.replace('_', ' ').toLowerCase()} 
                                    ({new Date(flag.timestamp).toLocaleTimeString()})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};