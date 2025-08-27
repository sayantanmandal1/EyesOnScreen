/**
 * Professional Gaze Monitoring UI Component
 * Real-time display of gaze tracking status during exams
 */

import { useState, useEffect, useCallback } from 'react';
import { professionalGazeMonitor } from '../../lib/professionalGazeMonitor';

export const ProfessionalGazeMonitor = ({
  isActive = false,
  onAlert = null,
  showDetailedMetrics = false,
  position = 'top-right' // 'top-right', 'top-left', 'bottom-right', 'bottom-left'
}) => {
  const [monitoringState, setMonitoringState] = useState({
    eyesOnScreen: true,
    gazeConfidence: 0,
    riskScore: 0,
    isTracking: false
  });
  
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageConfidence: 0,
    dataPoints: 0,
    alertsGenerated: 0
  });
  
  const [showDetails, setShowDetails] = useState(false);

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  // Start/stop monitoring based on isActive prop
  useEffect(() => {
    if (isActive) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [isActive]);

  const startMonitoring = useCallback(async () => {
    try {
      const success = await professionalGazeMonitor.start();
      
      if (success) {
        // Set up event listeners
        professionalGazeMonitor.on('gazeData', handleGazeData);
        professionalGazeMonitor.on('alert', handleAlert);
        professionalGazeMonitor.on('behaviorAnalysis', handleBehaviorAnalysis);
        
        console.log('Professional gaze monitoring UI started');
      } else {
        console.error('Failed to start professional gaze monitoring');
      }
    } catch (error) {
      console.error('Error starting gaze monitoring:', error);
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    professionalGazeMonitor.off('gazeData', handleGazeData);
    professionalGazeMonitor.off('alert', handleAlert);
    professionalGazeMonitor.off('behaviorAnalysis', handleBehaviorAnalysis);
    professionalGazeMonitor.stop();
  }, []);

  const handleGazeData = useCallback((gazePoint) => {
    setMonitoringState(prev => ({
      ...prev,
      eyesOnScreen: gazePoint.isOnScreen,
      gazeConfidence: gazePoint.confidence,
      isTracking: true
    }));
  }, []);

  const handleAlert = useCallback((alert) => {
    setRecentAlerts(prev => {
      const newAlerts = [alert, ...prev].slice(0, 5); // Keep last 5 alerts
      return newAlerts;
    });

    // Update risk score
    const currentState = professionalGazeMonitor.getCurrentState();
    setMonitoringState(prev => ({
      ...prev,
      riskScore: currentState.riskScore
    }));

    // Trigger parent callback
    if (onAlert) {
      onAlert(alert);
    }
  }, [onAlert]);

  const handleBehaviorAnalysis = useCallback((analysis) => {
    setPerformanceMetrics(prev => ({
      ...prev,
      averageConfidence: analysis.averageConfidence,
      dataPoints: analysis.dataPoints
    }));
  }, []);

  // Update performance metrics periodically
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const report = professionalGazeMonitor.getMonitoringReport();
      setPerformanceMetrics({
        averageConfidence: report.averageConfidence,
        dataPoints: report.gazeDataPoints,
        alertsGenerated: report.alertsGenerated
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      {/* Main monitoring widget */}
      <div className="bg-gray-900 rounded-lg border border-gray-600 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${monitoringState.isTracking ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-white text-sm font-medium">Gaze Monitor</span>
          </div>
          {showDetailedMetrics && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-gray-400 hover:text-white text-xs"
            >
              {showDetails ? '−' : '+'}
            </button>
          )}
        </div>

        {/* Status indicators */}
        <div className="p-3 space-y-2">
          {/* Eyes on screen status */}
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-xs">Eyes on Screen</span>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              monitoringState.eyesOnScreen 
                ? 'bg-green-900 text-green-300' 
                : 'bg-red-900 text-red-300'
            }`}>
              {monitoringState.eyesOnScreen ? 'Yes' : 'No'}
            </div>
          </div>

          {/* Gaze confidence */}
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-xs">Tracking Quality</span>
            <div className="flex items-center space-x-1">
              <div className="w-12 bg-gray-700 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    monitoringState.gazeConfidence > 0.7 ? 'bg-green-500' :
                    monitoringState.gazeConfidence > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${monitoringState.gazeConfidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">
                {Math.round(monitoringState.gazeConfidence * 100)}%
              </span>
            </div>
          </div>

          {/* Risk score */}
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-xs">Risk Level</span>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              monitoringState.riskScore < 30 ? 'bg-green-900 text-green-300' :
              monitoringState.riskScore < 70 ? 'bg-yellow-900 text-yellow-300' :
              'bg-red-900 text-red-300'
            }`}>
              {monitoringState.riskScore < 30 ? 'Low' :
               monitoringState.riskScore < 70 ? 'Medium' : 'High'}
            </div>
          </div>
        </div>

        {/* Detailed metrics (expandable) */}
        {showDetailedMetrics && showDetails && (
          <div className="border-t border-gray-700 p-3 space-y-2">
            <div className="text-xs text-gray-400 font-medium mb-2">Performance Metrics</div>
            
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Avg Confidence:</span>
              <span className="text-gray-300">{Math.round(performanceMetrics.averageConfidence * 100)}%</span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Data Points:</span>
              <span className="text-gray-300">{performanceMetrics.dataPoints}</span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Alerts Generated:</span>
              <span className="text-gray-300">{performanceMetrics.alertsGenerated}</span>
            </div>
          </div>
        )}

        {/* Recent alerts */}
        {recentAlerts.length > 0 && (
          <div className="border-t border-gray-700 p-3">
            <div className="text-xs text-gray-400 font-medium mb-2">Recent Alerts</div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {recentAlerts.slice(0, 3).map((alert, index) => (
                <div 
                  key={alert.id} 
                  className={`text-xs p-1 rounded ${
                    alert.severity === 'high' ? 'bg-red-900/30 text-red-300' :
                    alert.severity === 'medium' ? 'bg-yellow-900/30 text-yellow-300' :
                    'bg-blue-900/30 text-blue-300'
                  }`}
                >
                  {alert.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alert overlay for critical alerts */}
      {recentAlerts.length > 0 && recentAlerts[0].severity === 'high' && (
        <div className="mt-2 bg-red-900 border border-red-500 rounded-lg p-3 animate-pulse">
          <div className="text-red-300 text-sm font-medium">⚠ Attention Required</div>
          <div className="text-red-200 text-xs mt-1">
            {recentAlerts[0].message}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalGazeMonitor;