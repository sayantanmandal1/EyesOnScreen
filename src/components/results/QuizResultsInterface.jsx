/**
 * Main quiz results interface that brings together all results components
 */

import { useState } from 'react';
import { QuizResultsSummary } from './QuizResultsSummary';
import { QuizTimeline } from './QuizTimeline';
import { FlagExplanationSystem } from './FlagExplanationSystem';
import { ExportControls } from './ExportControls';

export const QuizResultsInterface = ({
  session,
  flags,
  riskScore,
  onRetakeQuiz,
  onClose,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState('summary');

  const tabs = [
    {
      id: 'summary',
      label: 'Summary',
      icon: '📊',
      description: 'Overall results and risk assessment'
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: '⏱️',
      description: 'Per-question timeline and events'
    },
    {
      id: 'flags',
      label: 'Explanations',
      icon: '❓',
      description: 'Why was I flagged?',
      badge: flags.length > 0 ? flags.length : undefined
    },
    {
      id: 'export',
      label: 'Export',
      icon: '💾',
      description: 'Download your data'
    }
  ];

  const getRiskLevelColor = (score) => {
    if (score >= 70) return 'text-red-600 bg-red-50 border-red-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (score >= 20) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getStatusMessage = () => {
    if (session.status === 'under-review') {
      return {
        type: 'warning',
        message: 'This quiz session has been flagged for review due to integrity concerns.',
        action: 'Contact your instructor for more information.'
      };
    }
    
    if (riskScore >= 70) {
      return {
        type: 'error',
        message: 'High risk score detected. This session may require additional verification.',
        action: 'Review the explanations tab to understand what was flagged.'
      };
    }
    
    if (riskScore >= 40) {
      return {
        type: 'warning',
        message: 'Some integrity concerns were noted during your quiz.',
        action: 'Check the explanations tab for details on how to improve.'
      };
    }
    
    return {
      type: 'success',
      message: 'Quiz completed successfully with minimal integrity concerns.',
      action: 'Great job maintaining academic integrity!'
    };
  };

  const statusMessage = getStatusMessage();

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Quiz Results
              </h1>
              <p className="text-gray-600 mt-1">
                {new Date(session.startTime).toLocaleDateString()} at {new Date(session.startTime).toLocaleTimeString()}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Risk score indicator */}
              <div className={`px-4 py-2 rounded-lg border font-medium ${getRiskLevelColor(riskScore)}`}>
                Risk Score: {riskScore}/100
              </div>
              
              {/* Action buttons */}
              <div className="flex space-x-2">
                {onRetakeQuiz && (
                  <button
                    onClick={onRetakeQuiz}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Retake Quiz
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>

          {/* Status message */}
          <div className={`mt-4 p-4 rounded-lg border ${
            statusMessage.type === 'error' ? 'bg-red-50 border-red-200' :
            statusMessage.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
            'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-start">
              <div className={`flex-shrink-0 ${
                statusMessage.type === 'error' ? 'text-red-600' :
                statusMessage.type === 'warning' ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {statusMessage.type === 'error' ? '🚨' :
                 statusMessage.type === 'warning' ? '⚠️' : '✅'}
              </div>
              <div className="ml-3">
                <div className={`font-medium ${
                  statusMessage.type === 'error' ? 'text-red-900' :
                  statusMessage.type === 'warning' ? 'text-yellow-900' :
                  'text-green-900'
                }`}>
                  {statusMessage.message}
                </div>
                <div className={`text-sm mt-1 ${
                  statusMessage.type === 'error' ? 'text-red-700' :
                  statusMessage.type === 'warning' ? 'text-yellow-700' :
                  'text-green-700'
                }`}>
                  {statusMessage.action}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {tab.description}
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'summary' && (
          <QuizResultsSummary
            session={session}
            flags={flags}
            riskScore={riskScore}
            showDetailedBreakdown={true}
          />
        )}

        {activeTab === 'timeline' && (
          <QuizTimeline
            session={session}
            flags={flags}
            showConfidenceData={true}
          />
        )}

        {activeTab === 'flags' && (
          <FlagExplanationSystem
            flags={flags}
          />
        )}

        {activeTab === 'export' && (
          <ExportControls
            session={session}
            flags={flags}
            riskScore={riskScore}
          />
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              <p>
                Quiz completed on {new Date(session.startTime).toLocaleDateString()} 
                {session.endTime && ` • Duration: ${Math.round((session.endTime - session.startTime) / 60000)} minutes`}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span>Session ID: {session.id}</span>
              <span>•</span>
              <span>Eyes-On-Screen Proctored Quiz v1.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};