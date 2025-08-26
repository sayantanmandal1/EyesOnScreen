/**
 * Export controls and download functionality
 */

import { useState } from 'react';
import { ExportManager } from '../../lib/data/ExportManager';

export const ExportControls = ({
  session,
  flags,
  riskScore,
  className = ''
}) => {
  const [exportOptions, setExportOptions] = useState({
    format: 'pdf',
    includeAnswers: true,
    includeFlags: true,
    includeTimeline: true,
    includePerformanceData: false,
    includePersonalData: false
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);

  const exportManager = new ExportManager();

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus('Preparing export...');

    try {
      const exportData = {
        session,
        flags,
        riskScore,
        exportOptions,
        exportTimestamp: Date.now()
      };

      let result;
      switch (exportOptions.format) {
        case 'json':
          setExportStatus('Generating JSON file...');
          result = await exportManager.exportToJSON(exportData);
          break;
        case 'csv':
          setExportStatus('Generating CSV file...');
          result = await exportManager.exportToCSV(exportData);
          break;
        case 'pdf':
          setExportStatus('Generating PDF report...');
          result = await exportManager.exportToPDF(exportData);
          break;
      }

      if (result.success) {
        setExportStatus('Export completed successfully!');
        setTimeout(() => setExportStatus(null), 3000);
      } else {
        setExportStatus(`Export failed: ${result.error}`);
        setTimeout(() => setExportStatus(null), 5000);
      }
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('Export failed. Please try again.');
      setTimeout(() => setExportStatus(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const getEstimatedFileSize = () => {
    let baseSize = 50; // KB base size
    
    if (exportOptions.includeAnswers) baseSize += 10;
    if (exportOptions.includeFlags) baseSize += flags.length * 2;
    if (exportOptions.includeTimeline) baseSize += 20;
    if (exportOptions.includePerformanceData) baseSize += 30;
    
    if (exportOptions.format === 'pdf') baseSize *= 2;
    if (exportOptions.format === 'json') baseSize *= 0.8;
    
    return Math.round(baseSize);
  };

  const getFormatDescription = (format) => {
    switch (format) {
      case 'json':
        return 'Machine-readable format with complete data structure. Best for technical analysis.';
      case 'csv':
        return 'Spreadsheet-compatible format. Best for data analysis in Excel or similar tools.';
      case 'pdf':
        return 'Human-readable report with charts and visualizations. Best for sharing and review.';
      default:
        return '';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Export Quiz Data
        </h3>
        <p className="text-gray-600">
          Download your quiz session data for your records or academic review.
        </p>
      </div>

      <div className="p-6">
        {/* Format selection */}
        <div className="mb-6">
          <h4 className="text-lg font-medium text-gray-900 mb-3">Export Format</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['json', 'csv', 'pdf']).map((format) => (
              <label
                key={format}
                className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                  exportOptions.format === format
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={format}
                  checked={exportOptions.format === format}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value }))}
                  className="sr-only"
                />
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 uppercase">
                        {format}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        {getFormatDescription(format)}
                      </div>
                    </div>
                  </div>
                </div>
                {exportOptions.format === format && (
                  <div className="absolute -inset-px rounded-lg border-2 border-blue-500 pointer-events-none" />
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Content options */}
        <div className="mb-6">
          <h4 className="text-lg font-medium text-gray-900 mb-3">Include in Export</h4>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includeAnswers}
                onChange={(e) => setExportOptions(prev => ({ ...prev, includeAnswers: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">Quiz Answers</div>
                <div className="text-xs text-gray-600">Your responses to all quiz questions</div>
              </div>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includeFlags}
                onChange={(e) => setExportOptions(prev => ({ ...prev, includeFlags: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">Integrity Flags</div>
                <div className="text-xs text-gray-600">Academic integrity alerts and explanations ({flags.length} total)</div>
              </div>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includeTimeline}
                onChange={(e) => setExportOptions(prev => ({ ...prev, includeTimeline: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">Timeline Data</div>
                <div className="text-xs text-gray-600">Per-question timing and event timeline</div>
              </div>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includePerformanceData}
                onChange={(e) => setExportOptions(prev => ({ ...prev, includePerformanceData: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">Performance Metrics</div>
                <div className="text-xs text-gray-600">System performance data and technical diagnostics</div>
              </div>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includePersonalData}
                onChange={(e) => setExportOptions(prev => ({ ...prev, includePersonalData: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">Calibration Profile</div>
                <div className="text-xs text-gray-600">Personal calibration settings and thresholds</div>
              </div>
            </label>
          </div>
        </div>

        {/* Export summary */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Export Summary</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Format:</span>
              <div className="font-medium text-gray-900 uppercase">{exportOptions.format}</div>
            </div>
            <div>
              <span className="text-gray-600">Estimated size:</span>
              <div className="font-medium text-gray-900">~{getEstimatedFileSize()} KB</div>
            </div>
            <div>
              <span className="text-gray-600">Sections:</span>
              <div className="font-medium text-gray-900">
                {Object.values(exportOptions).filter(v => typeof v === 'boolean' && v).length} included
              </div>
            </div>
          </div>
        </div>

        {/* Privacy notice */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h5 className="font-medium text-blue-900 mb-1">Privacy Notice</h5>
              <p className="text-blue-800 text-sm">
                Exported data contains only monitoring metrics and quiz responses. 
                No raw video or audio data is included. All data is processed locally 
                and only shared if you choose to upload it.
              </p>
            </div>
          </div>
        </div>

        {/* Export status */}
        {exportStatus && (
          <div className={`mb-4 p-3 rounded-lg ${
            exportStatus.includes('success') 
              ? 'bg-green-50 border border-green-200 text-green-800'
              : exportStatus.includes('failed')
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center">
              {isExporting && (
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {exportStatus}
            </div>
          </div>
        )}

        {/* Export button */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            File will be downloaded to your default downloads folder
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isExporting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }`}
          >
            {isExporting ? 'Exporting...' : `Export ${exportOptions.format.toUpperCase()}`}
          </button>
        </div>

        {/* Quick export options */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Quick Export Options</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setExportOptions({
                  format: 'pdf',
                  includeAnswers: true,
                  includeFlags: true,
                  includeTimeline: false,
                  includePerformanceData: false,
                  includePersonalData: false
                });
              }}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
            >
              📄 Basic Report (PDF)
            </button>
            
            <button
              onClick={() => {
                setExportOptions({
                  format: 'json',
                  includeAnswers: true,
                  includeFlags: true,
                  includeTimeline: true,
                  includePerformanceData: true,
                  includePersonalData: true
                });
              }}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
            >
              📊 Complete Data (JSON)
            </button>
            
            <button
              onClick={() => {
                setExportOptions({
                  format: 'csv',
                  includeAnswers: true,
                  includeFlags: true,
                  includeTimeline: true,
                  includePerformanceData: false,
                  includePersonalData: false
                });
              }}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
            >
              📈 Analysis Data (CSV)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};