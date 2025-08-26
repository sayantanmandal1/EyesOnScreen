/**
 * ServerSyncConsent - User consent management for server synchronization
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { ServerSync } from '../../lib/data/ServerSync';

interface ServerSyncConsentProps {
  serverSync: ServerSync;
  onConsentChange: (consent: boolean) => void;
  className?: string;
}

export const ServerSyncConsent: React.FC<ServerSyncConsentProps> = ({
  serverSync,
  onConsentChange,
  className = '',
}) => {
  const { privacySettings, updatePrivacySettings } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [syncStatus, setSyncStatus] = useState(serverSync.getSyncStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setSyncStatus(serverSync.getSyncStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, [serverSync]);

  const handleConsentToggle = async (enabled: boolean) => {
    updatePrivacySettings({ serverSyncEnabled: enabled });
    
    if (enabled) {
      // Show additional consent dialog for server sync
      const confirmed = window.confirm(
        'Enable server synchronization?\n\n' +
        'This will upload anonymized quiz session logs to our secure servers for audit purposes. ' +
        'No video data or personal information will be transmitted. ' +
        'You can disable this at any time.\n\n' +
        'Click OK to enable server sync, or Cancel to keep data local only.'
      );
      
      if (confirmed) {
        await serverSync.initialize(true);
        onConsentChange(true);
      } else {
        updatePrivacySettings({ serverSyncEnabled: false });
        onConsentChange(false);
      }
    } else {
      serverSync.disable();
      onConsentChange(false);
    }
  };

  return (
    <div className={`server-sync-consent ${className}`}>
      <div className="consent-header">
        <h3>Server Synchronization (Optional)</h3>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={privacySettings.serverSyncEnabled}
            onChange={(e) => handleConsentToggle(e.target.checked)}
            aria-label="Enable server synchronization"
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="consent-description">
        <p>
          Optionally sync anonymized session logs to secure servers for audit and review purposes.
          <strong> No video data or personal information is transmitted.</strong>
        </p>
        
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="details-toggle"
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {isExpanded && (
        <div className="consent-details">
          <h4>What data is synchronized?</h4>
          <ul>
            <li>Quiz session timestamps and duration</li>
            <li>Anonymized monitoring signals (gaze confidence, head pose angles)</li>
            <li>Flag events and risk scores</li>
            <li>Performance metrics (FPS, latency)</li>
            <li>Browser and system information (user agent, screen resolution)</li>
          </ul>

          <h4>What data is NOT synchronized?</h4>
          <ul>
            <li>Raw video frames or camera data</li>
            <li>Personal identifying information</li>
            <li>Quiz answers or content</li>
            <li>Facial landmarks or biometric data</li>
          </ul>

          <h4>Data Security</h4>
          <ul>
            <li>All data is encrypted in transit using HTTPS</li>
            <li>Data is stored securely with access controls</li>
            <li>You can request data deletion at any time</li>
            <li>Data retention follows institutional policies</li>
          </ul>

          {privacySettings.serverSyncEnabled && (
            <div className="sync-status">
              <h4>Sync Status</h4>
              <div className="status-grid">
                <div className="status-item">
                  <span className="label">Status:</span>
                  <span className={`value ${syncStatus.isAuthenticated ? 'connected' : 'disconnected'}`}>
                    {syncStatus.isAuthenticated ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="status-item">
                  <span className="label">Pending:</span>
                  <span className="value">{syncStatus.pendingBatches} batches</span>
                </div>
                <div className="status-item">
                  <span className="label">Failed:</span>
                  <span className="value">{syncStatus.failedBatches} batches</span>
                </div>
                <div className="status-item">
                  <span className="label">Last Sync:</span>
                  <span className="value">
                    {syncStatus.lastSyncTime 
                      ? new Date(syncStatus.lastSyncTime).toLocaleString()
                      : 'Never'
                    }
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .server-sync-consent {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
          background: #f9f9f9;
        }

        .consent-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .consent-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background-color: #2196F3;
        }

        input:checked + .toggle-slider:before {
          transform: translateX(26px);
        }

        .consent-description {
          margin-bottom: 12px;
        }

        .consent-description p {
          margin: 0 0 8px 0;
          font-size: 14px;
          line-height: 1.4;
        }

        .details-toggle {
          background: none;
          border: none;
          color: #2196F3;
          cursor: pointer;
          font-size: 14px;
          text-decoration: underline;
          padding: 0;
        }

        .details-toggle:hover {
          color: #1976D2;
        }

        .consent-details {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
        }

        .consent-details h4 {
          margin: 16px 0 8px 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .consent-details h4:first-child {
          margin-top: 0;
        }

        .consent-details ul {
          margin: 0 0 16px 0;
          padding-left: 20px;
        }

        .consent-details li {
          font-size: 13px;
          line-height: 1.4;
          margin-bottom: 4px;
        }

        .sync-status {
          background: #f0f0f0;
          border-radius: 6px;
          padding: 12px;
          margin-top: 16px;
        }

        .status-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }

        .status-item {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .status-item .label {
          font-weight: 500;
          color: #666;
        }

        .status-item .value {
          font-weight: 600;
        }

        .status-item .value.connected {
          color: #4CAF50;
        }

        .status-item .value.disconnected {
          color: #f44336;
        }

        @media (max-width: 768px) {
          .consent-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .status-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default ServerSyncConsent;