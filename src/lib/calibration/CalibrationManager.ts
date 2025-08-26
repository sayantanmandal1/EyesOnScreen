/**
 * CalibrationManager - Orchestrates the complete calibration process
 */

import { GazeCalibrator } from './GazeCalibrator';
import { EnvironmentCalibrator } from './EnvironmentCalibrator';
import { CalibrationSession, CalibrationQuality } from './types';
import { CalibrationProfile } from '../vision/types';

export class CalibrationManager {
  private gazeCalibrator: GazeCalibrator;
  private environmentCalibrator: EnvironmentCalibrator;
  private currentSession: CalibrationSession | null = null;

  constructor() {
    this.gazeCalibrator = new GazeCalibrator();
    this.environmentCalibrator = new EnvironmentCalibrator();
  }

  /**
   * Start a new calibration session
   */
  startCalibration(): CalibrationSession {
    const session: CalibrationSession = {
      id: `calibration-${Date.now()}`,
      startTime: Date.now(),
      steps: [
        {
          id: 'gaze-calibration',
          name: 'Gaze Calibration',
          description: 'Look at each dot as it appears on screen',
          duration: 30000,
          instructions: [
            'Keep your head still and centered',
            'Look directly at each dot when it appears',
            'Wait for the dot to disappear before moving your eyes'
          ],
          completed: false
        },
        {
          id: 'head-pose-calibration',
          name: 'Head Movement Calibration', 
          description: 'Follow the guided head movements',
          duration: 15000,
          instructions: [
            'Move your head slowly in each direction',
            'Keep your eyes looking at the center',
            'Return to center position between movements'
          ],
          completed: false
        },
        {
          id: 'environment-baseline',
          name: 'Environment Setup',
          description: 'Establishing lighting and environment baseline',
          duration: 10000,
          instructions: [
            'Sit still and look at the camera',
            'Ensure consistent lighting',
            'Remove any distracting objects from view'
          ],
          completed: false
        }
      ],
      currentStepIndex: 0,
      overallQuality: 0,
      status: 'not-started'
    };

    this.currentSession = session;
    this.gazeCalibrator.clearCalibrationData();
    
    return session;
  }

  /**
   * Process gaze calibration data
   */
  processGazeCalibration(data: any): boolean {
    if (!this.currentSession) return false;

    try {
      // Add calibration points to gaze calibrator
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((point: any) => {
          this.gazeCalibrator.addCalibrationPoint(point);
        });
      }

      // Calculate homography matrix
      const success = this.gazeCalibrator.calculateHomography();
      
      if (success) {
        // Mark gaze calibration step as completed
        const stepIndex = this.currentSession.steps.findIndex(s => s.id === 'gaze-calibration');
        if (stepIndex >= 0) {
          this.currentSession.steps[stepIndex].completed = true;
        }
      }

      return success;
    } catch (error) {
      console.error('Error processing gaze calibration:', error);
      return false;
    }
  }

  /**
   * Process head pose calibration data
   */
  processHeadPoseCalibration(data: any): boolean {
    if (!this.currentSession) return false;

    try {
      // Process head pose data (implementation will be enhanced in future tasks)
      // For now, just mark as completed
      const stepIndex = this.currentSession.steps.findIndex(s => s.id === 'head-pose-calibration');
      if (stepIndex >= 0) {
        this.currentSession.steps[stepIndex].completed = true;
      }

      return true;
    } catch (error) {
      console.error('Error processing head pose calibration:', error);
      return false;
    }
  }

  /**
   * Process environment baseline data
   */
  processEnvironmentBaseline(data: any): boolean {
    if (!this.currentSession) return false;

    try {
      // Add environment calibration data
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((sample: any) => {
          this.environmentCalibrator.addCalibrationData(sample);
        });
      }

      // Create environment baseline
      const baseline = this.environmentCalibrator.createBaseline();
      
      if (baseline) {
        // Mark environment baseline step as completed
        const stepIndex = this.currentSession.steps.findIndex(s => s.id === 'environment-baseline');
        if (stepIndex >= 0) {
          this.currentSession.steps[stepIndex].completed = true;
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error processing environment baseline:', error);
      return false;
    }
  }

  /**
   * Finalize calibration and create profile
   */
  finalizeCalibration(): { success: boolean; profile?: CalibrationProfile; quality?: CalibrationQuality } {
    if (!this.currentSession) {
      return { success: false };
    }

    try {
      // Check if all steps are completed
      const allStepsCompleted = this.currentSession.steps.every(step => step.completed);
      if (!allStepsCompleted) {
        return { success: false };
      }

      // Get calibration results from gaze calibrator
      const gazeResults = this.gazeCalibrator.getCalibrationResults();
      
      // Calculate overall quality
      const quality = gazeResults.quality;
      
      // Check if quality meets threshold
      if (quality.overall < 0.8) {
        return { success: false, quality };
      }

      // Get environment baseline
      const environmentBaseline = this.environmentCalibrator.getBaseline();

      // Create calibration profile
      const profile: CalibrationProfile = {
        ipd: this.calculateIPD(), // Mock implementation - will be enhanced
        earBaseline: this.calculateEAR(), // Mock implementation - will be enhanced
        gazeMapping: {
          homography: gazeResults.homographyMatrix || [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
          bias: gazeResults.biasVector
        },
        headPoseBounds: {
          yawRange: [-20, 20] as [number, number], // Will be calculated from head pose data
          pitchRange: [-15, 15] as [number, number]
        },
        lightingBaseline: {
          histogram: environmentBaseline?.lightingHistogram || new Array(256).fill(0),
          mean: environmentBaseline?.mean || 128,
          variance: environmentBaseline?.variance || 50
        },
        quality: quality.overall
      };

      // Update session
      this.currentSession.endTime = Date.now();
      this.currentSession.overallQuality = quality.overall;
      this.currentSession.profile = profile;
      this.currentSession.status = 'completed';

      return { success: true, profile, quality };
    } catch (error) {
      console.error('Error finalizing calibration:', error);
      return { success: false };
    }
  }

  /**
   * Calculate interpupillary distance (mock implementation)
   */
  private calculateIPD(): number {
    // This would be calculated from face landmarks in a real implementation
    // For now, return a typical value
    return 65; // mm
  }

  /**
   * Calculate eye aspect ratio baseline (mock implementation)
   */
  private calculateEAR(): number {
    // This would be calculated from eye landmarks in a real implementation
    // For now, return a typical value
    return 0.3;
  }

  /**
   * Get current calibration session
   */
  getCurrentSession(): CalibrationSession | null {
    return this.currentSession;
  }

  /**
   * Get calibration quality
   */
  getCalibrationQuality(): CalibrationQuality {
    return this.gazeCalibrator.calculateQuality();
  }

  /**
   * Check if calibration meets quality threshold
   */
  meetsQualityThreshold(): boolean {
    return this.gazeCalibrator.meetsQualityThreshold();
  }

  /**
   * Reset calibration
   */
  resetCalibration(): void {
    this.currentSession = null;
    this.gazeCalibrator.clearCalibrationData();
    this.environmentCalibrator.clearCalibrationData();
  }

  /**
   * Get environment calibrator for external use
   */
  getEnvironmentCalibrator(): EnvironmentCalibrator {
    return this.environmentCalibrator;
  }
}