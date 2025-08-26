/**
 * ExportManager - Handles data export in multiple formats (JSON, CSV, PDF)
 * Provides detailed session data, charts, and timeline visualizations
 */

import { SessionData, LogEntry, ExportFormat } from './types';
import { FlagEvent } from '../proctoring/types';
import { CalibrationProfile } from '../vision/types';

export interface ExportOptions {
  includeRawData: boolean;
  includeCharts: boolean;
  includeTimeline: boolean;
  includeCalibrationData: boolean;
  dateRange?: {
    start: number;
    end: number;
  };
  questionFilter?: string[];
}

export interface ExportResult {
  data: string | Uint8Array;
  filename: string;
  mimeType: string;
  size: number;
}

export interface TimelineEvent {
  timestamp: number;
  type: 'flag' | 'question_start' | 'question_end' | 'performance_warning';
  data: any;
  severity?: 'low' | 'medium' | 'high';
}

export class ExportManager {
  /**
   * Export session data in the specified format
   */
  async exportSessionData(
    sessionData: SessionData,
    format: ExportFormat['type'],
    options: ExportOptions = { includeRawData: true, includeCharts: false, includeTimeline: true, includeCalibrationData: false }
  ): Promise<ExportResult> {
    const filteredData = this.filterSessionData(sessionData, options);

    switch (format) {
      case 'json':
        return this.exportAsJSON(filteredData, options);
      case 'csv':
        return this.exportAsCSV(filteredData, options);
      case 'pdf':
        return this.exportAsPDF(filteredData, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export multiple sessions data
   */
  async exportMultipleSessions(
    sessions: SessionData[],
    format: ExportFormat['type'],
    options: ExportOptions = { includeRawData: true, includeCharts: false, includeTimeline: false, includeCalibrationData: false }
  ): Promise<ExportResult> {
    const aggregatedData = this.aggregateSessionsData(sessions, options);

    switch (format) {
      case 'json':
        return this.exportAggregatedJSON(aggregatedData, options);
      case 'csv':
        return this.exportAggregatedCSV(aggregatedData, options);
      case 'pdf':
        return this.exportAggregatedPDF(aggregatedData, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generate per-question timeline visualization data
   */
  generateQuestionTimeline(sessionData: SessionData): Record<string, TimelineEvent[]> {
    const timeline: Record<string, TimelineEvent[]> = {};
    
    // Get unique question IDs
    const questionIds = [...new Set(sessionData.logEntries.map(entry => entry.questionId).filter(Boolean))];
    
    questionIds.forEach(questionId => {
      if (!questionId) return;
      
      timeline[questionId] = [];
      
      // Add question start/end events
      const questionEntries = sessionData.logEntries.filter(entry => entry.questionId === questionId);
      if (questionEntries.length > 0) {
        timeline[questionId].push({
          timestamp: questionEntries[0].timestamp,
          type: 'question_start',
          data: { questionId },
        });
        
        timeline[questionId].push({
          timestamp: questionEntries[questionEntries.length - 1].timestamp,
          type: 'question_end',
          data: { questionId },
        });
      }
      
      // Add flags for this question
      const questionFlags = sessionData.flags.filter(flag => 
        flag.details?.questionId === questionId
      );
      
      questionFlags.forEach(flag => {
        timeline[questionId].push({
          timestamp: flag.timestamp,
          type: 'flag',
          data: flag,
          severity: flag.severity === 'hard' ? 'high' : 'medium',
        });
      });
      
      // Add performance warnings during this question
      const questionTimeRange = {
        start: questionEntries[0]?.timestamp || 0,
        end: questionEntries[questionEntries.length - 1]?.timestamp || Date.now(),
      };
      
      // Check for performance issues during question
      const performanceIssues = this.detectPerformanceIssues(questionEntries);
      performanceIssues.forEach(issue => {
        timeline[questionId].push({
          timestamp: issue.timestamp,
          type: 'performance_warning',
          data: issue,
          severity: 'low',
        });
      });
      
      // Sort timeline events by timestamp
      timeline[questionId].sort((a, b) => a.timestamp - b.timestamp);
    });
    
    return timeline;
  }

  /**
   * Filter session data based on export options
   */
  private filterSessionData(sessionData: SessionData, options: ExportOptions): SessionData {
    let filteredLogEntries = sessionData.logEntries;
    let filteredFlags = sessionData.flags;

    // Apply date range filter
    if (options.dateRange) {
      filteredLogEntries = filteredLogEntries.filter(entry => 
        entry.timestamp >= options.dateRange!.start && 
        entry.timestamp <= options.dateRange!.end
      );
      
      filteredFlags = filteredFlags.filter(flag => 
        flag.timestamp >= options.dateRange!.start && 
        flag.timestamp <= options.dateRange!.end
      );
    }

    // Apply question filter
    if (options.questionFilter && options.questionFilter.length > 0) {
      filteredLogEntries = filteredLogEntries.filter(entry => 
        !entry.questionId || options.questionFilter!.includes(entry.questionId)
      );
      
      filteredFlags = filteredFlags.filter(flag => 
        !flag.details?.questionId || options.questionFilter!.includes(flag.details.questionId as string)
      );
    }

    return {
      ...sessionData,
      logEntries: filteredLogEntries,
      flags: filteredFlags,
    };
  }

  /**
   * Export as JSON format
   */
  private async exportAsJSON(sessionData: SessionData, options: ExportOptions): Promise<ExportResult> {
    const exportData: any = {
      metadata: {
        exportTimestamp: Date.now(),
        exportOptions: options,
        sessionId: sessionData.sessionId,
        startTime: sessionData.startTime,
        endTime: sessionData.endTime,
        duration: sessionData.endTime ? sessionData.endTime - sessionData.startTime : null,
      },
      summary: {
        totalLogEntries: sessionData.logEntries.length,
        totalFlags: sessionData.flags.length,
        flagsByType: this.groupFlagsByType(sessionData.flags),
        performanceMetrics: sessionData.performanceMetrics,
        riskScore: this.calculateFinalRiskScore(sessionData),
      },
    };

    if (options.includeRawData) {
      exportData.rawData = {
        logEntries: sessionData.logEntries,
        flags: sessionData.flags,
      };
    }

    if (options.includeCalibrationData && sessionData.calibrationProfile) {
      exportData.calibrationProfile = sessionData.calibrationProfile;
    }

    if (options.includeTimeline) {
      exportData.timeline = this.generateQuestionTimeline(sessionData);
    }

    if (options.includeCharts) {
      exportData.chartData = this.generateChartData(sessionData);
    }

    const jsonString = JSON.stringify(exportData, null, 2);
    const filename = `session_${sessionData.sessionId}_${new Date().toISOString().split('T')[0]}.json`;

    return {
      data: jsonString,
      filename,
      mimeType: 'application/json',
      size: new Blob([jsonString]).size,
    };
  }

  /**
   * Export as CSV format
   */
  private async exportAsCSV(sessionData: SessionData, options: ExportOptions): Promise<ExportResult> {
    const csvData: string[] = [];

    // Add metadata header
    csvData.push('# Session Export Metadata');
    csvData.push(`# Session ID: ${sessionData.sessionId}`);
    csvData.push(`# Export Date: ${new Date().toISOString()}`);
    csvData.push(`# Total Log Entries: ${sessionData.logEntries.length}`);
    csvData.push(`# Total Flags: ${sessionData.flags.length}`);
    csvData.push('');

    // Log entries CSV
    if (options.includeRawData) {
      csvData.push('# Log Entries');
      csvData.push([
        'Timestamp',
        'Question ID',
        'Eyes On Screen',
        'Gaze Confidence',
        'Head Yaw',
        'Head Pitch',
        'Head Roll',
        'Shadow Score',
        'Secondary Face',
        'Device Like',
        'Tab Hidden',
        'Face Present',
        'Flag Type',
        'Risk Score'
      ].join(','));

      sessionData.logEntries.forEach(entry => {
        csvData.push([
          entry.timestamp,
          entry.questionId || '',
          entry.eyesOn,
          entry.gazeConfidence,
          entry.headPose.yaw,
          entry.headPose.pitch,
          entry.headPose.roll,
          entry.shadowScore,
          entry.secondaryFace,
          entry.deviceLike,
          entry.tabHidden,
          entry.facePresent,
          entry.flagType || '',
          entry.riskScore
        ].join(','));
      });

      csvData.push('');
    }

    // Flags CSV
    csvData.push('# Flag Events');
    csvData.push([
      'Flag ID',
      'Timestamp',
      'Type',
      'Severity',
      'Confidence',
      'Question ID',
      'Details'
    ].join(','));

    sessionData.flags.forEach(flag => {
      csvData.push([
        flag.id,
        flag.timestamp,
        flag.type,
        flag.severity,
        flag.confidence,
        flag.details?.questionId || '',
        JSON.stringify(flag.details).replace(/,/g, ';') // Escape commas in JSON
      ].join(','));
    });

    // Performance summary
    csvData.push('');
    csvData.push('# Performance Summary');
    csvData.push('Metric,Value');
    csvData.push(`Average FPS,${sessionData.performanceMetrics.averageFps}`);
    csvData.push(`Average Latency,${sessionData.performanceMetrics.averageLatency}`);
    csvData.push(`Peak Memory Usage,${sessionData.performanceMetrics.peakMemoryUsage}`);
    csvData.push(`Dropped Frames,${sessionData.performanceMetrics.droppedFrames}`);

    const csvString = csvData.join('\n');
    const filename = `session_${sessionData.sessionId}_${new Date().toISOString().split('T')[0]}.csv`;

    return {
      data: csvString,
      filename,
      mimeType: 'text/csv',
      size: new Blob([csvString]).size,
    };
  }

  /**
   * Export as PDF format (simplified implementation)
   */
  private async exportAsPDF(sessionData: SessionData, options: ExportOptions): Promise<ExportResult> {
    // This is a simplified PDF generation - in a real implementation,
    // you would use a library like jsPDF or PDFKit
    
    const pdfContent = this.generatePDFContent(sessionData, options);
    
    // For now, return as text content that could be converted to PDF
    const filename = `session_${sessionData.sessionId}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    return {
      data: pdfContent,
      filename,
      mimeType: 'application/pdf',
      size: new Blob([pdfContent]).size,
    };
  }

  /**
   * Generate PDF content (text representation)
   */
  private generatePDFContent(sessionData: SessionData, options: ExportOptions): string {
    const content: string[] = [];
    
    content.push('EYES-ON-SCREEN QUIZ SESSION REPORT');
    content.push('=' .repeat(50));
    content.push('');
    
    // Session metadata
    content.push('SESSION INFORMATION');
    content.push('-'.repeat(20));
    content.push(`Session ID: ${sessionData.sessionId}`);
    content.push(`Start Time: ${new Date(sessionData.startTime).toLocaleString()}`);
    if (sessionData.endTime) {
      content.push(`End Time: ${new Date(sessionData.endTime).toLocaleString()}`);
      content.push(`Duration: ${Math.round((sessionData.endTime - sessionData.startTime) / 1000 / 60)} minutes`);
    }
    content.push('');
    
    // Performance summary
    content.push('PERFORMANCE SUMMARY');
    content.push('-'.repeat(20));
    content.push(`Average FPS: ${sessionData.performanceMetrics.averageFps.toFixed(1)}`);
    content.push(`Average Latency: ${sessionData.performanceMetrics.averageLatency.toFixed(1)}ms`);
    content.push(`Peak Memory Usage: ${sessionData.performanceMetrics.peakMemoryUsage.toFixed(1)}MB`);
    content.push(`Dropped Frames: ${sessionData.performanceMetrics.droppedFrames}`);
    content.push('');
    
    // Flag summary
    const flagsByType = this.groupFlagsByType(sessionData.flags);
    content.push('FLAG SUMMARY');
    content.push('-'.repeat(20));
    content.push(`Total Flags: ${sessionData.flags.length}`);
    Object.entries(flagsByType).forEach(([type, count]) => {
      content.push(`${type}: ${count}`);
    });
    content.push('');
    
    // Risk assessment
    const riskScore = this.calculateFinalRiskScore(sessionData);
    content.push('RISK ASSESSMENT');
    content.push('-'.repeat(20));
    content.push(`Final Risk Score: ${riskScore}/100`);
    content.push(`Risk Level: ${this.getRiskLevel(riskScore)}`);
    content.push('');
    
    // Timeline (if requested)
    if (options.includeTimeline) {
      content.push('QUESTION TIMELINE');
      content.push('-'.repeat(20));
      const timeline = this.generateQuestionTimeline(sessionData);
      Object.entries(timeline).forEach(([questionId, events]) => {
        content.push(`Question ${questionId}:`);
        events.forEach(event => {
          const time = new Date(event.timestamp).toLocaleTimeString();
          content.push(`  ${time} - ${event.type}: ${JSON.stringify(event.data)}`);
        });
        content.push('');
      });
    }
    
    return content.join('\n');
  }

  /**
   * Aggregate data from multiple sessions
   */
  private aggregateSessionsData(sessions: SessionData[], options: ExportOptions): any {
    return {
      metadata: {
        exportTimestamp: Date.now(),
        totalSessions: sessions.length,
        dateRange: {
          start: Math.min(...sessions.map(s => s.startTime)),
          end: Math.max(...sessions.map(s => s.endTime || Date.now())),
        },
      },
      summary: {
        totalLogEntries: sessions.reduce((sum, s) => sum + s.logEntries.length, 0),
        totalFlags: sessions.reduce((sum, s) => sum + s.flags.length, 0),
        averageRiskScore: sessions.reduce((sum, s) => sum + this.calculateFinalRiskScore(s), 0) / sessions.length,
        performanceAverages: this.calculateAveragePerformance(sessions),
      },
      sessions: options.includeRawData ? sessions : sessions.map(s => ({
        sessionId: s.sessionId,
        startTime: s.startTime,
        endTime: s.endTime,
        flagCount: s.flags.length,
        riskScore: this.calculateFinalRiskScore(s),
      })),
    };
  }

  /**
   * Export aggregated JSON
   */
  private async exportAggregatedJSON(aggregatedData: any, options: ExportOptions): Promise<ExportResult> {
    const jsonString = JSON.stringify(aggregatedData, null, 2);
    const filename = `aggregated_sessions_${new Date().toISOString().split('T')[0]}.json`;

    return {
      data: jsonString,
      filename,
      mimeType: 'application/json',
      size: new Blob([jsonString]).size,
    };
  }

  /**
   * Export aggregated CSV
   */
  private async exportAggregatedCSV(aggregatedData: any, options: ExportOptions): Promise<ExportResult> {
    const csvData: string[] = [];
    
    // Header
    csvData.push('# Aggregated Sessions Export');
    csvData.push(`# Export Date: ${new Date().toISOString()}`);
    csvData.push(`# Total Sessions: ${aggregatedData.metadata.totalSessions}`);
    csvData.push('');
    
    // Sessions summary
    csvData.push('Session ID,Start Time,End Time,Duration (min),Flag Count,Risk Score');
    aggregatedData.sessions.forEach((session: any) => {
      const duration = session.endTime ? Math.round((session.endTime - session.startTime) / 1000 / 60) : 'N/A';
      csvData.push([
        session.sessionId,
        new Date(session.startTime).toISOString(),
        session.endTime ? new Date(session.endTime).toISOString() : 'N/A',
        duration,
        session.flagCount || 0,
        session.riskScore || 0
      ].join(','));
    });
    
    const csvString = csvData.join('\n');
    const filename = `aggregated_sessions_${new Date().toISOString().split('T')[0]}.csv`;

    return {
      data: csvString,
      filename,
      mimeType: 'text/csv',
      size: new Blob([csvString]).size,
    };
  }

  /**
   * Export aggregated PDF
   */
  private async exportAggregatedPDF(aggregatedData: any, options: ExportOptions): Promise<ExportResult> {
    const content: string[] = [];
    
    content.push('AGGREGATED SESSIONS REPORT');
    content.push('='.repeat(50));
    content.push('');
    content.push(`Total Sessions: ${aggregatedData.metadata.totalSessions}`);
    content.push(`Date Range: ${new Date(aggregatedData.metadata.dateRange.start).toLocaleDateString()} - ${new Date(aggregatedData.metadata.dateRange.end).toLocaleDateString()}`);
    content.push(`Average Risk Score: ${aggregatedData.summary.averageRiskScore.toFixed(1)}`);
    content.push('');
    
    // Add individual session summaries
    content.push('SESSION SUMMARIES');
    content.push('-'.repeat(20));
    aggregatedData.sessions.forEach((session: any) => {
      content.push(`${session.sessionId}: Risk ${session.riskScore}, Flags ${session.flagCount}`);
    });
    
    const pdfContent = content.join('\n');
    const filename = `aggregated_sessions_${new Date().toISOString().split('T')[0]}.pdf`;
    
    return {
      data: pdfContent,
      filename,
      mimeType: 'application/pdf',
      size: new Blob([pdfContent]).size,
    };
  }

  /**
   * Generate chart data for visualizations
   */
  private generateChartData(sessionData: SessionData): any {
    return {
      gazeConfidenceOverTime: sessionData.logEntries.map(entry => ({
        timestamp: entry.timestamp,
        value: entry.gazeConfidence,
      })),
      riskScoreOverTime: sessionData.logEntries.map(entry => ({
        timestamp: entry.timestamp,
        value: entry.riskScore,
      })),
      flagDistribution: this.groupFlagsByType(sessionData.flags),
      performanceMetrics: {
        fps: sessionData.performanceMetrics.averageFps,
        latency: sessionData.performanceMetrics.averageLatency,
        memory: sessionData.performanceMetrics.peakMemoryUsage,
        droppedFrames: sessionData.performanceMetrics.droppedFrames,
      },
    };
  }

  /**
   * Group flags by type
   */
  private groupFlagsByType(flags: FlagEvent[]): Record<string, number> {
    return flags.reduce((acc, flag) => {
      acc[flag.type] = (acc[flag.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Calculate final risk score from session data
   */
  private calculateFinalRiskScore(sessionData: SessionData): number {
    if (sessionData.logEntries.length === 0) return 0;
    
    const lastEntry = sessionData.logEntries[sessionData.logEntries.length - 1];
    return lastEntry.riskScore || 0;
  }

  /**
   * Get risk level description
   */
  private getRiskLevel(riskScore: number): string {
    if (riskScore < 20) return 'Low';
    if (riskScore < 40) return 'Medium';
    if (riskScore < 60) return 'High';
    return 'Critical';
  }

  /**
   * Detect performance issues in log entries
   */
  private detectPerformanceIssues(entries: LogEntry[]): Array<{ timestamp: number; type: string; details: any }> {
    const issues: Array<{ timestamp: number; type: string; details: any }> = [];
    
    // Look for patterns that indicate performance issues
    let consecutiveLowConfidence = 0;
    
    entries.forEach((entry, index) => {
      // Low gaze confidence
      if (entry.gazeConfidence < 0.5) {
        consecutiveLowConfidence++;
        if (consecutiveLowConfidence >= 5) {
          issues.push({
            timestamp: entry.timestamp,
            type: 'low_gaze_confidence',
            details: { confidence: entry.gazeConfidence, duration: consecutiveLowConfidence },
          });
        }
      } else {
        consecutiveLowConfidence = 0;
      }
    });
    
    return issues;
  }

  /**
   * Calculate average performance across sessions
   */
  private calculateAveragePerformance(sessions: SessionData[]): any {
    const totals = sessions.reduce((acc, session) => {
      acc.fps += session.performanceMetrics.averageFps;
      acc.latency += session.performanceMetrics.averageLatency;
      acc.memory += session.performanceMetrics.peakMemoryUsage;
      acc.droppedFrames += session.performanceMetrics.droppedFrames;
      return acc;
    }, { fps: 0, latency: 0, memory: 0, droppedFrames: 0 });

    const count = sessions.length;
    return {
      averageFps: totals.fps / count,
      averageLatency: totals.latency / count,
      averageMemoryUsage: totals.memory / count,
      totalDroppedFrames: totals.droppedFrames,
    };
  }
}