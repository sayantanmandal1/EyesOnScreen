/**
 * ToastContainer - Manages multiple toast notifications
 */

import { ToastNotification } from './ToastNotification';

export const ToastContainer = ({
  alerts,
  onDismiss,
  maxVisible = 3,
  position = 'top-right',
}) => {
  // Only show soft alerts in toast container
  const softAlerts = alerts.filter(alert => alert.type === 'soft');
  
  // Limit the number of visible toasts
  const visibleAlerts = softAlerts.slice(-maxVisible);

  if (visibleAlerts.length === 0) {
    return null;
  }

  const getContainerClasses = () => {
    const baseClasses = 'fixed z-40 pointer-events-none';
    const positions = {
      'top-right': 'top-0 right-0',
      'top-left': 'top-0 left-0',
      'bottom-right': 'bottom-0 right-0',
      'bottom-left': 'bottom-0 left-0',
    };
    return `${baseClasses} ${positions[position]}`;
  };

  return (
    <div className={getContainerClasses()}>
      <div className="flex flex-col space-y-2 p-4">
        {visibleAlerts.map((alert, index) => (
          <div
            key={alert.id}
            className="pointer-events-auto"
            style={{
              // Stagger the animations slightly
              animationDelay: `${index * 100}ms`,
            }}
          >
            <ToastNotification
              alert={alert}
              onDismiss={onDismiss}
              position={position}
            />
          </div>
        ))}
      </div>
    </div>
  );
};