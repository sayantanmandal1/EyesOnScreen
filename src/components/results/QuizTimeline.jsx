/**
 * Per-question timeline visualization with monitoring markers
 */

import React, { useState, useMemo } from 'react';

export const QuizTimeline = ({
  session,
  flags,
  className = '',
  showConfidenceData = false
}) => {
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Generate timeline events
  const timelineEvents = useMemo(() => {
    const events = [];
    
    // Add question events
    session.questions.forEach((question, index) => {
      const questionStartTime = session.startTime + (index * 30000); // Estimated
      events.push({
        timestamp: questionStartTime,
        type: 'question-start',
        questionId: question.id,
        questionIndex: index,
        data: { question }
      });
      
      if (session.answers[question.id]) {
        events.push({
          timestamp: questionStartTime + 15000, // Estimated answer time
          type: 'answer-change',
          questionId: question.id,
          questionIndex: index,
          data: { answer: session.answers[question.id] }
        });
      }
      
      events.push({
        timestamp: questionStartTime + 30000,
        type: 'question-end',
        questionId: question.id,
        questionIndex: index
      });
    });
    
    // Add flag events
    flags.forEach(flag => {
      events.push({
        timestamp: flag.timestamp,
        type: 'flag',
        questionId: flag.questionId,
        flagData: flag
      });
    });
    
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }, [session, flags]);

  const totalDuration = session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime;
  const timelineWidth = Math.max(800, totalDuration / 1000 * zoomLevel); // 1px per second at zoom level 1

  const getEventPosition = (timestamp) => {
    const relativeTime = timestamp - session.startTime;
    return (relativeTime / totalDuration) * timelineWidth;
  };

  const getEventColor = (event) => {
    switch (event.type) {
      case 'question-start':
        return 'bg-blue-500';
      case 'question-end':
        return 'bg-gray-400';
      case 'answer-change':
        return 'bg-green-500';
      case 'flag':
        return event.flagData?.severity === 'hard' ? 'bg-red-500' : 'bg-yellow-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getEventIcon = (event) => {
    switch (event.type) {
      case 'question-start':
        return '▶️';
      case 'question-end':
        return '⏹️';
      case 'answer-change':
        return '✏️';
      case 'flag':
        return event.flagData?.severity === 'hard' ? '🚨' : '⚠️';
      default:
        return '•';
    }
  };

  const formatTime = (timestamp) => {
    const relativeTime = timestamp - session.startTime;
    const minutes = Math.floor(relativeTime / 60000);
    const seconds = Math.floor((relativeTime % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getQuestionDuration = (questionIndex) => {
    const questionEvents = timelineEvents.filter(e => e.questionIndex === questionIndex);
    const startEvent = questionEvents.find(e => e.type === 'question-start');
    const endEvent = questionEvents.find(e => e.type === 'question-end');
    
    if (startEvent && endEvent) {
      return endEvent.timestamp - startEvent.timestamp;
    }
    return 30000; // Default 30 seconds
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">
          Quiz Timeline
        </h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Zoom:</label>
            <select
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Total: {Math.round(totalDuration / 60000)}m {Math.round((totalDuration % 60000) / 1000)}s
          </div>
        </div>
      </div>

      {/* Timeline legend */}
      <div className="flex items-center space-x-6 mb-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span>Question Start</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>Answer Submitted</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <span>Soft Alert</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span>Hard Alert</span>
        </div>
      </div>

      {/* Question overview */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-gray-900 mb-3">Questions Overview</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {session.questions.map((question, index) => {
            const questionFlags = flags.filter(f => f.questionId === question.id);
            const duration = getQuestionDuration(index);
            const isAnswered = session.answers[question.id];
            
            return (
              <button
                key={question.id}
                onClick={() => setSelectedQuestion(selectedQuestion === index ? null : index)}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  selectedQuestion === index
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">
                    Question {index + 1}
                  </span>
                  <div className="flex items-center space-x-1">
                    {isAnswered && <span className="text-green-600 text-sm">✓</span>}
                    {questionFlags.length > 0 && (
                      <span className="text-red-600 text-sm">
                        {questionFlags.length}🚨
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  Duration: {Math.round(duration / 1000)}s
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {question.text}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main timeline */}
      <div className="relative">
        <h4 className="text-lg font-medium text-gray-900 mb-3">Timeline Visualization</h4>
        
        {/* Timeline container */}
        <div className="relative overflow-x-auto border border-gray-200 rounded-lg">
          <div className="relative h-32 bg-gray-50" style={{ width: `${timelineWidth}px` }}>
            {/* Time markers */}
            <div className="absolute top-0 left-0 right-0 h-6 border-b border-gray-200">
              {Array.from({ length: Math.ceil(totalDuration / 60000) + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-6 border-l border-gray-300"
                  style={{ left: `${(i * 60000 / totalDuration) * timelineWidth}px` }}
                >
                  <span className="absolute top-1 left-1 text-xs text-gray-500">
                    {i}m
                  </span>
                </div>
              ))}
            </div>

            {/* Question blocks */}
            {session.questions.map((question, index) => {
              const startTime = session.startTime + (index * 30000);
              const duration = getQuestionDuration(index);
              const startPos = getEventPosition(startTime);
              const width = (duration / totalDuration) * timelineWidth;
              const questionFlags = flags.filter(f => f.questionId === question.id);
              const isSelected = selectedQuestion === index;
              
              return (
                <div
                  key={question.id}
                  className={`absolute top-6 h-16 border-2 rounded transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-100 z-10'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                  style={{
                    left: `${startPos}px`,
                    width: `${width}px`
                  }}
                  onClick={() => setSelectedQuestion(isSelected ? null : index)}
                >
                  <div className="p-2 h-full flex flex-col justify-between">
                    <div className="text-xs font-medium text-gray-900">
                      Q{index + 1}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600">
                        {Math.round(duration / 1000)}s
                      </div>
                      {questionFlags.length > 0 && (
                        <div className="text-xs text-red-600">
                          {questionFlags.length}🚨
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Event markers */}
            {timelineEvents.map((event, index) => (
              <div
                key={index}
                className={`absolute w-3 h-3 rounded-full ${getEventColor(event)} border-2 border-white shadow-sm`}
                style={{
                  left: `${getEventPosition(event.timestamp) - 6}px`,
                  top: event.type === 'flag' ? '84px' : '22px'
                }}
                title={`${event.type} at ${formatTime(event.timestamp)}`}
              >
                <span className="absolute -top-6 -left-2 text-xs">
                  {getEventIcon(event)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected question details */}
        {selectedQuestion !== null && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-2">
              Question {selectedQuestion + 1} Details
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-blue-800 mb-2">
                  <strong>Question:</strong> {session.questions[selectedQuestion].text}
                </div>
                <div className="text-blue-700">
                  <strong>Your Answer:</strong> {session.answers[session.questions[selectedQuestion].id] || 'No answer'}
                </div>
              </div>
              <div>
                <div className="text-blue-700 mb-2">
                  <strong>Duration:</strong> {Math.round(getQuestionDuration(selectedQuestion) / 1000)} seconds
                </div>
                <div className="text-blue-700">
                  <strong>Flags:</strong> {flags.filter(f => f.questionId === session.questions[selectedQuestion].id).length}
                </div>
              </div>
            </div>
            
            {/* Question-specific flags */}
            {flags.filter(f => f.questionId === session.questions[selectedQuestion].id).length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <strong className="text-blue-900">Integrity Alerts:</strong>
                <ul className="mt-1 space-y-1">
                  {flags
                    .filter(f => f.questionId === session.questions[selectedQuestion].id)
                    .map(flag => (
                      <li key={flag.id} className="text-sm text-blue-800">
                        • {flag.type.replace('_', ' ').toLowerCase()} at {formatTime(flag.timestamp)}
                        {flag.confidence && ` (${Math.round(flag.confidence * 100)}% confidence)`}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};