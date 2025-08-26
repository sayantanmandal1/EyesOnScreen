/**
 * Tests for ExportManager class
 */

import { ExportManager } from '../ExportManager';
import { SessionData, LogEntry } from '../types';
import { FlagEvent } from '../../proctoring/types';
import { CalibrationProfile } from '../../vision/types';

describe('ExportManager', () => {
  let exportManager: ExportManager;
  let mockSessionData: SessionData;

  beforeEach(() => {
    exportManager = new ExportManager();

    const mockLogEntries: LogEntry[] = [
      {
        timestamp: 1000,
        questionId: 'q1',
        eyesOn: true,
        gazeConfidence: 0.8,
        headPose: { yaw: 5, pitch: -2, roll: 1 },
        shadowScore: 0.1,
        secondaryFace: false,
        deviceLike: false,
        tabHidden: false,
        facePresent: true,
        flagType: null,
        riskScore: 10,
      },
      {
        timestamp: 2000,
        questionId: 'q1',
        eyesOn: false,
        gazeConfidence: 0.3,
        headPose: { yaw: 15, pitch: -5, roll: 2 },
        shadowScore: 0.2,
        secondaryFace: false,
        deviceLike: false,
        tabHidden: false,
        facePresent: true,
        flagType: 'EYES_OFF',
        riskScore: 25,
      },
      {
        timestamp: 3000,
        questionId: 'q2',
        eyesOn: true,
        gazeConfidence: 0.9,
        headPose: { yaw: 2, pitch: -1, roll: 0 },
        shadowScore: 0.05,
        secondaryFace: false,
        deviceLike: false,
        tabHidden: false,
        facePresent: true,
        flagType: null,
        riskScore: 20,
      },
    ];

    const mockFlags: FlagEvent[] = [
      {
        id: 'flag1',
        timestamp: 2000,
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.7,
        details: { questionId: 'q1', duration: 500 },
      },
      {
        id: 'flag2',
        timestamp: 4000,
        type: 'HEAD_POSE',
        severity: 'hard',
        confidence: 0.9,
        details: { questionId: 'q2', yaw: 25 },
      },
    ];

    const mockCalibrationProfile: CalibrationProfile = {
      id: 'profile1',
      ipd: 65,
      earBaseline: 0.3,
      gazeMapping: {
        homography: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        bias: [0, 0],
      },
      headPoseBounds: {
        yawRange: [-20, 20],
        pitchRange: [-15, 15],
      },
      lightingBaseline: {
        histogram: [1, 2, 3],
        mean: 128,
        variance: 10,
      },
      quality: 0.9,
      timestamp: Date.now(),
    };

    mockSessionData = {
      sessionId: 'test-session-1',
      startTime: 1000,
      endTime: 5000,
      calibrationProfile: mockCalibrationProfile,
      quizSession: {
        id: 'quiz1',
        questions: [],
        answers: {},
        startTime: 1000,
        currentQuestionIndex: 0,
        flags: mockFlags,
        riskScore: 25,
        status: 'completed',
      },
      logEntries: mockLogEntries,
      flags: mockFlags,
      performanceMetrics: {
        averageFps: 30,
        averageLatency: 25,
        peakMemoryUsage: 150,
        droppedFrames: 2,
      },
    };
  });

  describe('JSON export', () => {
    it('should export session data as JSON with all options', async () => {
      const result = await exportManager.exportSessionData(mockSessionData, 'json', {
        includeRawData: true,
        includeCharts: true,
        includeTimeline: true,
        includeCalibrationData: true,
      });

      expect(result.mimeType).toBe('application/json');
      expect(result.filename).toMatch(/session_test-session-1_\d{4}-\d{2}-\d{2}\.json/);
      expect(typeof result.data).toBe('string');

      const parsedData = JSON.parse(result.data as string);
      
      expect(parsedData.metadata).toMatchObject({
        sessionId: 'test-session-1',
        startTime: 1000,
        endTime: 5000,
      });

      expect(parsedData.summary).toMatchObject({
        totalLogEntries: 3,
        totalFlags: 2,
        performanceMetrics: mockSessionData.performanceMetrics,
      });

      expect(parsedData.rawData).toBeDefined();
      expect(parsedData.calibrationProfile).toBeDefined();
      expect(parsedData.timeline).toBeDefined();
      expect(parsedData.chartData).toBeDefined();
    });

    it('should export minimal JSON without optional data', async () => {
      const result = await exportManager.exportSessionData(mockSessionData, 'json', {
        includeRawData: false,
        includeCharts: false,
        includeTimeline: false,
        includeCalibrationData: false,
      });

      const parsedData = JSON.parse(result.data as string);
      
      expect(parsedData.rawData).toBeUndefined();
      expect(parsedData.calibrationProfile).toBeUndefined();
      expect(parsedData.timeline).toBeUndefined();
      expect(parsedData.chartData).toBeUndefined();
      
      expect(parsedData.metadata).toBeDefined();
      expect(parsedData.summary).toBeDefined();
    });
  });

  describe('CSV export', () => {
    it('should export session data as CSV', async () => {
      const result = await exportManager.exportSessionData(mockSessionData, 'csv', {
        includeRawData: true,
        includeCharts: false,
        includeTimeline: false,
        includeCalibrationData: false,
      });

      expect(result.mimeType).toBe('text/csv');
      expect(result.filename).toMatch(/session_test-session-1_\d{4}-\d{2}-\d{2}\.csv/);
      expect(typeof result.data).toBe('string');

      const csvContent = result.data as string;
      
      // Check for metadata
      expect(csvContent).toContain('# Session ID: test-session-1');
      expect(csvContent).toContain('# Total Log Entries: 3');
      expect(csvContent).toContain('# Total Flags: 2');

      // Check for log entries header
      expect(csvContent).toContain('Timestamp,Question ID,Eyes On Screen');

      // Check for flag events header
      expect(csvContent).toContain('Flag ID,Timestamp,Type,Severity');

      // Check for performance summary
      expect(csvContent).toContain('Average FPS,30');
      expect(csvContent).toContain('Average Latency,25');
    });

    it('should handle CSV export without raw data', async () => {
      const result = await exportManager.exportSessionData(mockSessionData, 'csv', {
        includeRawData: false,
        includeCharts: false,
        includeTimeline: false,
        includeCalibrationData: false,
      });

      const csvContent = result.data as string;
      
      // Should not contain log entries section
      expect(csvContent).not.toContain('# Log Entries');
      expect(csvContent).not.toContain('Timestamp,Question ID,Eyes On Screen');
      
      // Should still contain flags and performance
      expect(csvContent).toContain('# Flag Events');
      expect(csvContent).toContain('# Performance Summary');
    });
  });

  describe('PDF export', () => {
    it('should export session data as PDF content', async () => {
      const result = await exportManager.exportSessionData(mockSessionData, 'pdf', {
        includeRawData: false,
        includeCharts: false,
        includeTimeline: true,
        includeCalibrationData: false,
      });

      expect(result.mimeType).toBe('application/pdf');
      expect(result.filename).toMatch(/session_test-session-1_\d{4}-\d{2}-\d{2}\.pdf/);
      expect(typeof result.data).toBe('string');

      const pdfContent = result.data as string;
      
      expect(pdfContent).toContain('EYES-ON-SCREEN QUIZ SESSION REPORT');
      expect(pdfContent).toContain('Session ID: test-session-1');
      expect(pdfContent).toContain('PERFORMANCE SUMMARY');
      expect(pdfContent).toContain('FLAG SUMMARY');
      expect(pdfContent).toContain('RISK ASSESSMENT');
      expect(pdfContent).toContain('QUESTION TIMELINE');
    });
  });

  describe('data filtering', () => {
    it('should filter data by date range', async () => {
      const result = await exportManager.exportSessionData(mockSessionData, 'json', {
        includeRawData: true,
        includeCharts: false,
        includeTimeline: false,
        includeCalibrationData: false,
        dateRange: {
          start: 1500,
          end: 2500,
        },
      });

      const parsedData = JSON.parse(result.data as string);
      
      // Should only include entries within the date range
      expect(parsedData.rawData.logEntries).toHaveLength(1);
      expect(parsedData.rawData.logEntries[0].timestamp).toBe(2000);
      
      expect(parsedData.rawData.flags).toHaveLength(1);
      expect(parsedData.rawData.flags[0].timestamp).toBe(2000);
    });

    it('should filter data by question IDs', async () => {
      const result = await exportManager.exportSessionData(mockSessionData, 'json', {
        includeRawData: true,
        includeCharts: false,
        includeTimeline: false,
        includeCalibrationData: false,
        questionFilter: ['q1'],
      });

      const parsedData = JSON.parse(result.data as string);
      
      // Should only include entries for question q1
      expect(parsedData.rawData.logEntries).toHaveLength(2);
      parsedData.rawData.logEntries.forEach((entry: LogEntry) => {
        expect(entry.questionId).toBe('q1');
      });
      
      expect(parsedData.rawData.flags).toHaveLength(1);
      expect(parsedData.rawData.flags[0].details.questionId).toBe('q1');
    });
  });

  describe('timeline generation', () => {
    it('should generate question timeline correctly', () => {
      const timeline = exportManager.generateQuestionTimeline(mockSessionData);

      expect(timeline).toHaveProperty('q1');
      expect(timeline).toHaveProperty('q2');

      // Check q1 timeline
      const q1Timeline = timeline['q1'];
      expect(q1Timeline).toContainEqual(
        expect.objectContaining({
          type: 'question_start',
          data: { questionId: 'q1' },
        })
      );
      expect(q1Timeline).toContainEqual(
        expect.objectContaining({
          type: 'question_end',
          data: { questionId: 'q1' },
        })
      );
      expect(q1Timeline).toContainEqual(
        expect.objectContaining({
          type: 'flag',
          data: expect.objectContaining({ type: 'EYES_OFF' }),
        })
      );

      // Timeline should be sorted by timestamp
      for (let i = 1; i < q1Timeline.length; i++) {
        expect(q1Timeline[i].timestamp).toBeGreaterThanOrEqual(q1Timeline[i - 1].timestamp);
      }
    });
  });

  describe('multiple sessions export', () => {
    it('should export multiple sessions as aggregated JSON', async () => {
      const session2: SessionData = {
        ...mockSessionData,
        sessionId: 'test-session-2',
        startTime: 6000,
        endTime: 10000,
      };

      const result = await exportManager.exportMultipleSessions(
        [mockSessionData, session2],
        'json',
        { includeRawData: false, includeCharts: false, includeTimeline: false, includeCalibrationData: false }
      );

      expect(result.filename).toMatch(/aggregated_sessions_\d{4}-\d{2}-\d{2}\.json/);

      const parsedData = JSON.parse(result.data as string);
      
      expect(parsedData.metadata.totalSessions).toBe(2);
      expect(parsedData.summary.totalLogEntries).toBe(6); // 3 entries per session
      expect(parsedData.summary.totalFlags).toBe(4); // 2 flags per session
      expect(parsedData.sessions).toHaveLength(2);
    });

    it('should export multiple sessions as aggregated CSV', async () => {
      const session2: SessionData = {
        ...mockSessionData,
        sessionId: 'test-session-2',
        startTime: 6000,
        endTime: 10000,
      };

      const result = await exportManager.exportMultipleSessions(
        [mockSessionData, session2],
        'csv',
        { includeRawData: false, includeCharts: false, includeTimeline: false, includeCalibrationData: false }
      );

      const csvContent = result.data as string;
      
      expect(csvContent).toContain('# Total Sessions: 2');
      expect(csvContent).toContain('Session ID,Start Time,End Time');
      expect(csvContent).toContain('test-session-1');
      expect(csvContent).toContain('test-session-2');
    });
  });

  describe('chart data generation', () => {
    it('should generate chart data correctly', () => {
      const result = exportManager.exportSessionData(mockSessionData, 'json', {
        includeRawData: false,
        includeCharts: true,
        includeTimeline: false,
        includeCalibrationData: false,
      });

      return result.then(exportResult => {
        const parsedData = JSON.parse(exportResult.data as string);
        const chartData = parsedData.chartData;

        expect(chartData.gazeConfidenceOverTime).toHaveLength(3);
        expect(chartData.gazeConfidenceOverTime[0]).toMatchObject({
          timestamp: 1000,
          value: 0.8,
        });

        expect(chartData.riskScoreOverTime).toHaveLength(3);
        expect(chartData.flagDistribution).toEqual({
          'EYES_OFF': 1,
          'HEAD_POSE': 1,
        });

        expect(chartData.performanceMetrics).toMatchObject({
          fps: 30,
          latency: 25,
          memory: 150,
          droppedFrames: 2,
        });
      });
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported export format', async () => {
      await expect(
        exportManager.exportSessionData(mockSessionData, 'xml' as any)
      ).rejects.toThrow('Unsupported export format: xml');
    });

    it('should handle empty session data', async () => {
      const emptySession: SessionData = {
        sessionId: 'empty-session',
        startTime: Date.now(),
        calibrationProfile: mockSessionData.calibrationProfile,
        quizSession: mockSessionData.quizSession,
        logEntries: [],
        flags: [],
        performanceMetrics: {
          averageFps: 0,
          averageLatency: 0,
          peakMemoryUsage: 0,
          droppedFrames: 0,
        },
      };

      const result = await exportManager.exportSessionData(emptySession, 'json');
      const parsedData = JSON.parse(result.data as string);

      expect(parsedData.summary.totalLogEntries).toBe(0);
      expect(parsedData.summary.totalFlags).toBe(0);
    });
  });

  describe('utility methods', () => {
    it('should calculate risk levels correctly', async () => {
      // Test different risk scores
      const testCases = [
        { riskScore: 10, expectedLevel: 'Low' },
        { riskScore: 30, expectedLevel: 'Medium' },
        { riskScore: 50, expectedLevel: 'High' },
        { riskScore: 70, expectedLevel: 'Critical' },
      ];

      for (const testCase of testCases) {
        const sessionWithRisk = {
          ...mockSessionData,
          logEntries: [{
            ...mockSessionData.logEntries[0],
            riskScore: testCase.riskScore,
          }],
        };

        const result = await exportManager.exportSessionData(sessionWithRisk, 'pdf');
        expect(result.data).toContain(`Risk Level: ${testCase.expectedLevel}`);
      }
    });

    it('should format file sizes correctly', () => {
      const result = exportManager.exportSessionData(mockSessionData, 'json');
      
      return result.then(exportResult => {
        expect(exportResult.size).toBeGreaterThan(0);
        expect(typeof exportResult.size).toBe('number');
      });
    });
  });
});