/**
 * IntegrityViolationAlert - Component for displaying integrity violation alerts
 */

import {
  AlertTriangle,
  Shield,
  Mouse,
  Code,
  Maximize,
  ExternalLink
} from 'lucide-react';

const getViolationIcon = (type) => {
  switch (type) {
    case 'copy-paste':
      return <Shield size={20} />;
    case 'right-click':
      return <Mouse size={20} />;
    case 'dev-tools':
      return <Code size={20} />;
    case 'fullscreen-exit':
      return <Maximize size={20} />;
    case 'tab-blur':
      return <ExternalLink size={20} />;
    default:
      return <AlertTriangle size={20} />;
  }
};

const getViolationTitle = (type) => {
  switch (type) {
    case 'copy-paste':
      return 'Copy/Paste Detected';
    case 'right-click':
      return 'Right-Click Detected';
    case 'dev-tools':
      return 'Developer Tools Detected';
    case 'fullscreen-exit':
      return 'Fullscreen Mode Exited';
    case 'tab-blur':
      return 'Tab Switch Detected';
    default:
      return 'Integrity Violation';
  }
};

const getViolationMessage = (type) => {
  switch (type) {
    case 'copy-paste':
      return 'Copy and paste operations are not allowed during the quiz. This action has been blocked and flagged.';
    case 'right-click':
      return 'Right-click context menus are disabled during the quiz to maintain academic integrity.';
    case 'dev-tools':
      return 'Developer tools and browser debugging features are not allowed during the quiz.';
    case 'fullscreen-exit':
      return 'You have exited fullscreen mode. Please return to fullscreen to continue the quiz.';
    case 'tab-blur':
      return 'Switching tabs or windows is not allowed during the quiz. This action has been flagged.';
    default:
      return 'An integrity violation has been detected and flagged.';
  }
};

const getViolationSeverity = (type) => {
  switch (type) {
    case 'copy-paste':
    case 'dev-tools':
    case 'fullscreen-exit':
      return 'error';
    case 'right-click':
    case 'tab-blur':
      return 'warning';
    default:
      return 'warning';
  }
};

export const IntegrityViolationAlert = ({
  violation,
  onAcknowledge,
  className = ''
}) => {
  const severity = getViolationSeverity(violation.type);
  const icon = getViolationIcon(violation.type);
  const title = getViolationTitle(violation.type);
  const message = getViolationMessage(violation.type);

  const severityClasses = {
    warning: {
      container: 'bg-orange-50 border-orange-200',
      icon: 'text-orange-500',
      title: 'text-orange-800',
      message: 'text-orange-700',
      button: 'bg-orange-600 hover:bg-orange-700'
    },
    error: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-500',
      title: 'text-red-800',
      message: 'text-red-700',
      button: 'bg-red-600 hover:bg-red-700'
    }
  };

  const classes = severityClasses[severity];

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className={`border rounded-lg p-4 ${classes.container}`}>
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 ${classes.icon}`}>
              {icon}
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold ${classes.title}`}>
                {title}
              </h3>
              <p className={`mt-2 text-sm ${classes.message}`}>
                {message}
              </p>

              {violation.details && Object.keys(violation.details).length > 0 && (
                <div className="mt-3 text-xs text-gray-600">
                  <details>
                    <summary className="cursor-pointer hover:text-gray-800">
                      Technical Details
                    </summary>
                    <pre className="mt-2 bg-gray-100 p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(violation.details, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          {onAcknowledge && (
            <button
              onClick={onAcknowledge}
              className={`px-4 py-2 text-white rounded-md transition-colors ${classes.button}`}
            >
              I Understand
            </button>
          )}
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p>
            <strong>Time:</strong> {new Date(violation.timestamp).toLocaleTimeString()}
          </p>
          <p className="mt-1">
            This violation has been recorded and may affect your quiz results.
          </p>
        </div>
      </div>
    </div>
  );
};

export default IntegrityViolationAlert;