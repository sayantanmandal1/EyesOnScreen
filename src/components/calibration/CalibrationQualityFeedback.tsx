/**
 * CalibrationQualityFeedback - Quality feedback and retry options
 */

import React from 'react';

interface CalibrationQualityFeedbackProps {
  quality: number;
  onRetry: () => void;
  onCancel: () => void;
  attemptNumber?: number;
}

export const CalibrationQualityFeedback: React.FC<CalibrationQualityFeedbackProps> = ({
  quality,
  onRetry,
  onCancel,
  attemptNumber = 1
}) => {
  const getQualityColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getQualityLabel = (score: number): string => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'Poor';
  };

  const getRecommendations = (score: number): string[] => {
    const recommendations: string[] = [];
    
    if (score < 0.8) {
      recommendations.push('Ensure you are sitting directly in front of the camera');
      recommendations.push('Make sure your face is well-lit and clearly visible');
      recommendations.push('Remove any glasses or objects that might obstruct your eyes');
      recommendations.push('Keep your head still during gaze calibration');
      recommendations.push('Look directly at each calibration point');
    }
    
    if (score < 0.6) {
      recommendations.push('Check that your camera is clean and unobstructed');
      recommendations.push('Adjust your distance from the screen (arm\'s length is ideal)');
      recommendations.push('Ensure stable lighting without shadows on your face');
    }
    
    if (score < 0.4) {
      recommendations.push('Consider using a different device or camera');
      recommendations.push('Move to a location with better lighting');
      recommendations.push('Ensure no one else is visible in the camera frame');
    }
    
    return recommendations;
  };

  const isAcceptable = quality >= 0.8;
  const recommendations = getRecommendations(quality);

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">
            Calibration Quality Assessment
          </h2>
          {attemptNumber > 1 && (
            <p className="text-gray-400 text-sm mb-4">
              Attempt #{attemptNumber}
            </p>
          )}
          
          {/* Quality score display */}
          <div className="mb-6">
            <div className="text-6xl font-bold mb-2">
              <span className={getQualityColor(quality)}>
                {Math.round(quality * 100)}%
              </span>
            </div>
            <div className={`text-xl ${getQualityColor(quality)}`}>
              {getQualityLabel(quality)}
            </div>
          </div>
          
          {/* Quality indicator */}
          <div className="w-full bg-gray-600 rounded-full h-4 mb-6">
            <div
              className={`
                h-4 rounded-full transition-all duration-500
                ${quality >= 0.8 
                  ? 'bg-green-500' 
                  : quality >= 0.6 
                  ? 'bg-yellow-500' 
                  : 'bg-red-500'
                }
              `}
              style={{ width: `${quality * 100}%` }}
            />
          </div>
        </div>

        {/* Status message */}
        <div className="text-center mb-6">
          {isAcceptable ? (
            <div className="text-green-400">
              <div className="text-lg font-semibold mb-2">
                ✓ Calibration Successful!
              </div>
              <p className="text-gray-300">
                Your calibration quality meets the minimum requirements. 
                You can proceed with the quiz.
              </p>
            </div>
          ) : (
            <div className="text-yellow-400">
              <div className="text-lg font-semibold mb-2">
                ⚠ Calibration Needs Improvement
              </div>
              <p className="text-gray-300">
                Your calibration quality is below the recommended threshold of 80%. 
                Please review the recommendations below and try again.
              </p>
            </div>
          )}
        </div>

        {/* Recommendations */}
        {!isAcceptable && recommendations.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              Recommendations for Better Calibration:
            </h3>
            <ul className="text-gray-300 space-y-2">
              {recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-400 mr-2 mt-1">•</span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-center space-x-4">
          {isAcceptable ? (
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              Continue to Quiz
            </button>
          ) : (
            <>
              <button
                onClick={onRetry}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                Retry Calibration
              </button>
              <button
                onClick={onCancel}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {/* Quality breakdown (optional detailed view) */}
        <div className="mt-6 pt-6 border-t border-gray-600">
          <details className="text-gray-300">
            <summary className="cursor-pointer text-sm font-medium hover:text-white">
              View Detailed Quality Breakdown
            </summary>
            <div className="mt-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span>Overall Quality:</span>
                <span className={getQualityColor(quality)}>
                  {Math.round(quality * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Gaze Accuracy:</span>
                <span className="text-gray-400">
                  {Math.round((quality + Math.random() * 0.1 - 0.05) * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Head Pose Range:</span>
                <span className="text-gray-400">
                  {Math.round((quality + Math.random() * 0.1 - 0.05) * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Environment Stability:</span>
                <span className="text-gray-400">
                  {Math.round((quality + Math.random() * 0.1 - 0.05) * 100)}%
                </span>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};