/**
 * AlertManager - Integrates toast notifications and modal dialogs
 */

import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { ToastContainer } from './ToastContainer';
import { AlertModal } from './AlertModal';
import { AlertEngine } from '../../lib/proctoring/AlertEngine';

export const AlertManager = forwardRef(({
  config,
  onAlertAcknowledged,
  onAlertDismissed,
}, ref) => {
  const [alertEngine, setAlertEngine] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [currentHardAlert, setCurrentHardAlert] = useState(null);

  useEffect(() => {
    const callbacks = {
      onSoftAlert: (alert) => {
        setActiveAlerts(prev => [...prev, alert]);
      },
      onHardAlert: (alert) => {
        setActiveAlerts(prev => [...prev, alert]);
        setCurrentHardAlert(alert);
      },
      onAlertDismissed: (alertId) => {
        setActiveAlerts(prev => prev.filter(alert => alert.id !== alertId));

        // Clear hard alert if it's the one being dismissed
        setCurrentHardAlert(prev =>
          prev && prev.id === alertId ? null : prev
        );

        onAlertDismissed?.(alertId);
      },
    };

    const engine = new AlertEngine(config, callbacks);
    setAlertEngine(engine);

    return () => {
      engine.dispose();
    };
  }, [config, onAlertDismissed]);

  // Expose processFlag method to parent components
  useEffect(() => {
    if (alertEngine) {
      // Store reference to engine for external access
      window.__alertEngine = alertEngine;
    }

    return () => {
      delete window.__alertEngine;
    };
  }, [alertEngine]);

  const handleToastDismiss = (alertId) => {
    alertEngine?.dismissAlert(alertId);
  };

  const handleModalAcknowledge = (alertId) => {
    const alert = activeAlerts.find(a => a.id === alertId);
    if (alert) {
      onAlertAcknowledged?.(alert);
    }
    alertEngine?.acknowledgeAlert(alertId);
  };

  const handleModalDismiss = (alertId) => {
    alertEngine?.dismissAlert(alertId);
  };

  // Process flags from external sources
  const processFlag = (flag) => {
    alertEngine?.processFlag(flag);
  };

  // Expose processFlag method
  useImperativeHandle(
    ref,
    () => ({
      processFlag,
      clearAllAlerts: () => alertEngine?.clearAllAlerts() || undefined,
      getActiveAlerts: () => alertEngine?.getActiveAlerts() || [],
    }),
    [alertEngine, processFlag]
  );

  return (
    <>
      {/* Toast notifications for soft alerts */}
      <ToastContainer
        alerts={activeAlerts}
        onDismiss={handleToastDismiss}
        maxVisible={config.toast.maxVisible}
        position="top-right"
      />

      {/* Modal dialog for hard alerts */}
      {currentHardAlert && (
        <AlertModal
          alert={currentHardAlert}
          onAcknowledge={handleModalAcknowledge}
          onDismiss={handleModalDismiss}
        />
      )}
    </>
  );
});

AlertManager.displayName = 'AlertManager';

// Hook for using AlertManager in components
export const useAlertManager = () => {
  const processFlag = (flag) => {
    const engine = window.__alertEngine;
    if (engine) {
      engine.processFlag(flag);
    }
  };

  const clearAllAlerts = () => {
    const engine = window.__alertEngine;
    if (engine) {
      engine.clearAllAlerts();
    }
  };

  const getActiveAlerts = () => {
    const engine = window.__alertEngine;
    return engine ? engine.getActiveAlerts() : [];
  };

  return {
    processFlag,
    clearAllAlerts,
    getActiveAlerts,
  };
};