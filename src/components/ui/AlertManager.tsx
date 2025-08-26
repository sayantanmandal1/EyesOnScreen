/**
 * AlertManager - Integrates toast notifications and modal dialogs
 */

import React, { useEffect, useState } from 'react';
import { ToastContainer } from './ToastContainer';
import { AlertModal } from './AlertModal';
import { AlertEngine, AlertEngineConfig, AlertState, AlertCallbacks } from '../../lib/proctoring/AlertEngine';
import { FlagEvent } from '../../lib/proctoring/types';

interface AlertManagerProps {
  config: AlertEngineConfig;
  onAlertAcknowledged?: (alert: AlertState) => void;
  onAlertDismissed?: (alertId: string) => void;
}

export interface AlertManagerRef {
  processFlag: (flag: FlagEvent) => void;
  clearAllAlerts: () => void;
  getActiveAlerts: () => AlertState[];
}

export const AlertManager = React.forwardRef<AlertManagerRef, AlertManagerProps>(({
  config,
  onAlertAcknowledged,
  onAlertDismissed,
}, ref) => {
  const [alertEngine, setAlertEngine] = useState<AlertEngine | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<AlertState[]>([]);
  const [currentHardAlert, setCurrentHardAlert] = useState<AlertState | null>(null);

  useEffect(() => {
    const callbacks: AlertCallbacks = {
      onSoftAlert: (alert: AlertState) => {
        setActiveAlerts(prev => [...prev, alert]);
      },
      onHardAlert: (alert: AlertState) => {
        setActiveAlerts(prev => [...prev, alert]);
        setCurrentHardAlert(alert);
      },
      onAlertDismissed: (alertId: string) => {
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
      (window as any).__alertEngine = alertEngine;
    }
    
    return () => {
      delete (window as any).__alertEngine;
    };
  }, [alertEngine]);

  const handleToastDismiss = (alertId: string) => {
    alertEngine?.dismissAlert(alertId);
  };

  const handleModalAcknowledge = (alertId: string) => {
    const alert = activeAlerts.find(a => a.id === alertId);
    if (alert) {
      onAlertAcknowledged?.(alert);
    }
    alertEngine?.acknowledgeAlert(alertId);
  };

  const handleModalDismiss = (alertId: string) => {
    alertEngine?.dismissAlert(alertId);
  };

  // Process flags from external sources
  const processFlag = (flag: FlagEvent) => {
    alertEngine?.processFlag(flag);
  };

  // Expose processFlag method
  React.useImperativeHandle(
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
  const processFlag = (flag: FlagEvent) => {
    const engine = (window as any).__alertEngine as AlertEngine;
    if (engine) {
      engine.processFlag(flag);
    }
  };

  const clearAllAlerts = () => {
    const engine = (window as any).__alertEngine as AlertEngine;
    if (engine) {
      engine.clearAllAlerts();
    }
  };

  const getActiveAlerts = (): AlertState[] => {
    const engine = (window as any).__alertEngine as AlertEngine;
    return engine ? engine.getActiveAlerts() : [];
  };

  return {
    processFlag,
    clearAllAlerts,
    getActiveAlerts,
  };
};