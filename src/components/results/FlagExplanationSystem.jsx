/**
 * Flag explanation system - "Why was I flagged?"
 */

import React, { useState } from 'react';

/**
 * @typedef {Object} FlagEvent
 * @property {string} id
 * @property {string} type
 * @property {string} severity - "soft" | "hard"
 * @property {number} confidence
 * @property {number} timestamp
 * @property {string} [questionId]
 */

/**
 * @param {{ flags: FlagEvent[], className?: string }} props
 */
export const FlagExplanationSystem = ({ flags, className = '' }) => {
  const [expandedExplanation, setExpandedExplanation] = useState(null);

  const flagExplanations = {
    EYES_OFF: {
      type: 'EYES_OFF',
      title: 'Eyes Off Screen',
      description:
        'The system detected that your gaze was directed away from the quiz content for an extended period.',
      commonCauses: [
        'Looking at notes, books, or other materials',
        'Glancing at a second monitor or device',
        'Looking away to think or concentrate',
        'Poor lighting causing inaccurate gaze detection',
        'Wearing glasses that interfere with eye tracking',
      ],
      prevention: [
        'Keep your eyes focused on the quiz questions',
        'Remove any unauthorized materials from your workspace',
        'Ensure good, even lighting on your face',
        'Sit directly in front of your camera',
        "If wearing glasses, ensure they don't create glare",
      ],
      severity: 'soft',
      icon: '👀',
    },
    HEAD_POSE: {
      type: 'HEAD_POSE',
      title: 'Head Position Out of Range',
      description:
        'Your head position moved outside the acceptable range, which may indicate looking at unauthorized materials.',
      commonCauses: [
        'Turning head to look at notes or other materials',
        'Leaning too far forward or backward',
        'Looking up at ceiling or down at desk',
        'Adjusting position in chair frequently',
        'Poor initial calibration',
      ],
      prevention: [
        'Maintain a consistent, upright posture',
        'Keep your head centered and facing the camera',
        'Avoid excessive head movements',
        'Ensure proper calibration before starting',
        'Use a comfortable chair that supports good posture',
      ],
      severity: 'soft',
      icon: '🔄',
    },
    TAB_BLUR: {
      type: 'TAB_BLUR',
      title: 'Browser Tab Lost Focus',
      description:
        'The quiz tab lost focus, indicating you may have switched to another application or browser tab.',
      commonCauses: [
        'Switching to another browser tab',
        'Opening another application',
        'Clicking outside the browser window',
        'Receiving notifications that steal focus',
        'Using Alt+Tab or Cmd+Tab to switch applications',
      ],
      prevention: [
        'Close all unnecessary applications before starting',
        'Disable notifications during the quiz',
        'Keep the quiz tab active at all times',
        'Avoid clicking outside the browser window',
        'Use fullscreen mode if available',
      ],
      severity: 'hard',
      icon: '🪟',
    },
    SECOND_FACE: {
      type: 'SECOND_FACE',
      title: 'Additional Person Detected',
      description:
        'The system detected another person in the camera view, which violates quiz integrity policies.',
      commonCauses: [
        'Someone else entering the room',
        'Taking the quiz in a shared space',
        'Reflections showing another person',
        'Photos or posters with faces in the background',
        'Video calls or screens showing other people',
      ],
      prevention: [
        'Take the quiz in a private, isolated room',
        'Ensure no one else is present during the quiz',
        'Remove photos or posters with faces from view',
        'Close all video calling applications',
        'Check your background for reflective surfaces',
      ],
      severity: 'hard',
      icon: '👥',
    },
    DEVICE_OBJECT: {
      type: 'DEVICE_OBJECT',
      title: 'Unauthorized Device Detected',
      description:
        'The system detected what appears to be an electronic device (phone, tablet, etc.) in your workspace.',
      commonCauses: [
        'Phone or tablet visible on desk',
        'Smart watch or fitness tracker',
        'Calculator or electronic device',
        'Second monitor or screen',
        'Reflective objects mistaken for devices',
      ],
      prevention: [
        'Remove all electronic devices from your workspace',
        'Put phones and tablets in another room',
        'Cover or remove reflective objects',
        'Use only the computer taking the quiz',
        'Clear your desk of all unnecessary items',
      ],
      severity: 'hard',
      icon: '📱',
    },
    SHADOW_ANOMALY: {
      type: 'SHADOW_ANOMALY',
      title: 'Lighting Conditions Changed',
      description:
        'Significant changes in lighting or shadows were detected, which may indicate environmental manipulation.',
      commonCauses: [
        'Someone else moving in the room',
        'Turning lights on or off',
        'Opening or closing curtains/blinds',
        'Objects being moved in the background',
        'Natural lighting changes (clouds, sunset)',
      ],
      prevention: [
        'Maintain consistent lighting throughout the quiz',
        'Close curtains to avoid natural light changes',
        'Ensure no one else is in the room',
        'Avoid moving objects during the quiz',
        'Test your lighting setup before starting',
      ],
      severity: 'soft',
      icon: '💡',
    },
    FACE_MISSING: {
      type: 'FACE_MISSING',
      title: 'Face Not Detected',
      description:
        'The system temporarily lost track of your face, which may indicate you left the camera view.',
      commonCauses: [
        'Moving too far from the camera',
        'Covering face with hands',
        'Looking down for extended periods',
        'Poor lighting making face detection difficult',
        'Technical issues with camera or software',
      ],
      prevention: [
        "Stay within the camera's field of view",
        'Maintain good lighting on your face',
        'Avoid covering your face with hands',
        'Keep your head up and facing the camera',
        'Check camera functionality before starting',
      ],
      severity: 'soft',
      icon: '❓',
    },
    DOWN_GLANCE: {
      type: 'DOWN_GLANCE',
      title: 'Frequent Downward Glances',
      description:
        'The system detected a pattern of frequent downward glances, which may indicate reading notes.',
      commonCauses: [
        'Looking at notes or cheat sheets on desk',
        'Reading from books or papers',
        'Using a phone or device below camera view',
        'Natural tendency to look down while thinking',
        'Poor monitor positioning requiring downward glances',
      ],
      prevention: [
        'Remove all notes and materials from your desk',
        'Position your monitor at eye level',
        'Keep your gaze focused on the screen',
        'Think with your eyes on the quiz content',
        'Clear your workspace of all materials',
      ],
      severity: 'soft',
      icon: '👇',
    },
  };

  /** @type {Record<string, FlagEvent[]>} */
  const groupedFlags = flags.reduce((acc, flag) => {
    if (!acc[flag.type]) {
      acc[flag.type] = [];
    }
    acc[flag.type].push(flag);
    return acc;
  }, {});

  const toggleExplanation = (flagType) => {
    setExpandedExplanation(expandedExplanation === flagType ? null : flagType);
  };

  if (flags.length === 0) {
    return (
      <div
        className={`bg-green-50 border border-green-200 rounded-lg p-6 text-center ${className}`}
      >
        <div className="text-green-600 text-4xl mb-4">✅</div>
        <h3 className="text-lg font-semibold text-green-900 mb-2">
          No Integrity Flags
        </h3>
        <p className="text-green-700">
          Great job! No academic integrity concerns were detected during your
          quiz.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}
    >
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Why Was I Flagged?
        </h3>
        <p className="text-gray-600">
          Understanding your academic integrity alerts and how to prevent them
          in the future.
        </p>
      </div>

      <div className="p-6">
        {/* Summary */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Summary</h4>
          <div className="text-blue-800 text-sm">
            <p className="mb-2">
              Your quiz session generated <strong>{flags.length}</strong>{' '}
              integrity alert{flags.length !== 1 ? 's' : ''} across{' '}
              <strong>{Object.keys(groupedFlags).length}</strong> different
              categor
              {Object.keys(groupedFlags).length !== 1 ? 'ies' : 'y'}.
            </p>
            <p>
              <strong>Hard alerts:</strong>{' '}
              {flags.filter((f) => f.severity === 'hard').length} |{' '}
              <strong> Soft alerts:</strong>{' '}
              {flags.filter((f) => f.severity === 'soft').length}
            </p>
          </div>
        </div>

        {/* Flag explanations */}
        <div className="space-y-4">
          {Object.entries(groupedFlags).map(([flagType, flagList]) => {
            const explanation = flagExplanations[flagType];
            if (!explanation) return null;

            const isExpanded = expandedExplanation === flagType;
            const hardFlags = flagList.filter((f) => f.severity === 'hard')
              .length;

            return (
              <div
                key={flagType}
                className="border border-gray-200 rounded-lg"
              >
                <button
                  onClick={() => toggleExplanation(flagType)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{explanation.icon}</span>
                      <div>
                        <h5 className="font-semibold text-gray-900">
                          {explanation.title}
                        </h5>
                        <p className="text-sm text-gray-600">
                          {flagList.length} occurrence
                          {flagList.length !== 1 ? 's' : ''}
                          {hardFlags > 0 && (
                            <span className="ml-2 text-red-600">
                              ({hardFlags} major)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          explanation.severity === 'hard'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {explanation.severity === 'hard' ? 'Major' : 'Minor'}
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="mt-4 space-y-4">
                      {/* Description */}
                      <div>
                        <h6 className="font-medium text-gray-900 mb-2">
                          What happened?
                        </h6>
                        <p className="text-gray-700 text-sm">
                          {explanation.description}
                        </p>
                      </div>

                      {/* Occurrences */}
                      <div>
                        <h6 className="font-medium text-gray-900 mb-2">
                          When did this occur? ({flagList.length} time
                          {flagList.length !== 1 ? 's' : ''})
                        </h6>
                        <div className="space-y-2">
                          {flagList.slice(0, 5).map((flag) => (
                            <div
                              key={flag.id}
                              className="text-sm text-gray-600 bg-gray-50 p-2 rounded"
                            >
                              <div className="flex items-center justify-between">
                                <span>
                                  {new Date(
                                    flag.timestamp
                                  ).toLocaleTimeString()}
                                  {flag.questionId &&
                                    ` (Question ${flag.questionId})`}
                                </span>
                                <span
                                  className={`px-2 py-1 rounded text-xs ${
                                    flag.severity === 'hard'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                >
                                  {Math.round(flag.confidence * 100)}%
                                  confidence
                                </span>
                              </div>
                            </div>
                          ))}
                          {flagList.length > 5 && (
                            <div className="text-sm text-gray-500 text-center">
                              ... and {flagList.length - 5} more occurrence
                              {flagList.length - 5 !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Common causes */}
                      <div>
                        <h6 className="font-medium text-gray-900 mb-2">
                          Common causes:
                        </h6>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {explanation.commonCauses.map((cause, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-gray-400 mr-2">•</span>
                              {cause}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Prevention */}
                      <div>
                        <h6 className="font-medium text-gray-900 mb-2">
                          How to prevent this:
                        </h6>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {explanation.prevention.map((tip, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* General tips */}
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-semibold text-green-900 mb-3">
            General Tips for Future Quizzes
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-green-800">
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Take quizzes in a quiet, private room
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Remove all unauthorized materials
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Ensure good, consistent lighting
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Position camera at eye level
              </li>
            </ul>
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Close all unnecessary applications
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Maintain consistent posture
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Keep eyes focused on screen
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Complete calibration carefully
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
