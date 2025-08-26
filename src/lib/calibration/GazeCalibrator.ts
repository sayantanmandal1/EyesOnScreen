/**
 * GazeCalibrator - Screen-to-gaze mapping and calibration logic
 */

import { GazeCalibrationData, CalibrationQuality } from './types';

export class GazeCalibrator {
  private calibrationData: GazeCalibrationData[] = [];
  private homographyMatrix: number[][] | null = null;
  private biasVector: number[] = [0, 0];
  private qualityThreshold = 0.8;

  /**
   * Add calibration data point
   */
  addCalibrationPoint(data: GazeCalibrationData): void {
    this.calibrationData.push(data);
  }

  /**
   * Clear all calibration data
   */
  clearCalibrationData(): void {
    this.calibrationData = [];
    this.homographyMatrix = null;
    this.biasVector = [0, 0];
  }

  /**
   * Calculate homography matrix for gaze transformation
   */
  calculateHomography(): boolean {
    if (this.calibrationData.length < 4) {
      console.warn('Insufficient calibration points for homography calculation');
      return false;
    }

    try {
      // Extract screen points and gaze points
      const screenPoints = this.calibrationData.map(d => [d.screenPoint.x, d.screenPoint.y]);
      const gazePoints = this.calibrationData.map(d => [d.gazePoint.x, d.gazePoint.y]);

      // Calculate homography using DLT (Direct Linear Transform) algorithm
      this.homographyMatrix = this.computeHomographyDLT(screenPoints, gazePoints);
      
      // Calculate bias correction
      this.biasVector = this.calculateBiasCorrection();

      return this.homographyMatrix !== null;
    } catch (error) {
      console.error('Error calculating homography:', error);
      return false;
    }
  }

  /**
   * Compute homography matrix using Direct Linear Transform
   */
  private computeHomographyDLT(srcPoints: number[][], dstPoints: number[][]): number[][] | null {
    if (srcPoints.length !== dstPoints.length || srcPoints.length < 4) {
      return null;
    }

    // Build the A matrix for the linear system Ah = 0
    const A: number[][] = [];
    
    for (let i = 0; i < srcPoints.length; i++) {
      const [x, y] = srcPoints[i];
      const [u, v] = dstPoints[i];
      
      // Each point contributes two rows to the A matrix
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, -u]);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y, -v]);
    }

    // Solve using SVD (simplified implementation)
    const h = this.solveLeastSquares(A);
    
    if (!h) return null;

    // Reshape h into 3x3 matrix
    return [
      [h[0], h[1], h[2]],
      [h[3], h[4], h[5]],
      [h[6], h[7], h[8]]
    ];
  }

  /**
   * Simplified least squares solver for homography
   */
  private solveLeastSquares(A: number[][]): number[] | null {
    // This is a simplified implementation
    // In production, you would use a proper SVD implementation
    
    const rows = A.length;
    const cols = A[0].length;
    
    // Use normal equations: (A^T * A) * h = A^T * b
    // Since we're solving Ah = 0, we find the eigenvector corresponding to smallest eigenvalue
    
    // For now, return a mock solution that represents an identity-like transformation
    // This should be replaced with proper SVD implementation
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }

  /**
   * Calculate bias correction vector
   */
  private calculateBiasCorrection(): number[] {
    if (!this.homographyMatrix || this.calibrationData.length === 0) {
      return [0, 0];
    }

    let totalBiasX = 0;
    let totalBiasY = 0;

    for (const data of this.calibrationData) {
      const predicted = this.transformPoint(data.screenPoint.x, data.screenPoint.y);
      const actual = [data.gazePoint.x, data.gazePoint.y];
      
      totalBiasX += actual[0] - predicted[0];
      totalBiasY += actual[1] - predicted[1];
    }

    return [
      totalBiasX / this.calibrationData.length,
      totalBiasY / this.calibrationData.length
    ];
  }

  /**
   * Transform screen coordinates to gaze coordinates
   */
  transformPoint(screenX: number, screenY: number): number[] {
    if (!this.homographyMatrix) {
      return [screenX, screenY]; // No transformation available
    }

    const h = this.homographyMatrix;
    
    // Apply homography transformation
    const w = h[2][0] * screenX + h[2][1] * screenY + h[2][2];
    const x = (h[0][0] * screenX + h[0][1] * screenY + h[0][2]) / w;
    const y = (h[1][0] * screenX + h[1][1] * screenY + h[1][2]) / w;

    // Apply bias correction
    return [
      x + this.biasVector[0],
      y + this.biasVector[1]
    ];
  }

  /**
   * Calculate personal threshold for gaze cone angles
   */
  calculatePersonalThresholds(): { gazeAccuracy: number; confidenceThreshold: number } {
    if (this.calibrationData.length === 0) {
      return { gazeAccuracy: 50, confidenceThreshold: 0.7 }; // Default values
    }

    // Calculate average error distance
    let totalError = 0;
    let validPoints = 0;

    for (const data of this.calibrationData) {
      if (data.confidence > 0.5) { // Only use high-confidence points
        const predicted = this.transformPoint(data.screenPoint.x, data.screenPoint.y);
        const actual = [data.gazePoint.x, data.gazePoint.y];
        
        const error = Math.sqrt(
          Math.pow(predicted[0] - actual[0], 2) + 
          Math.pow(predicted[1] - actual[1], 2)
        );
        
        totalError += error;
        validPoints++;
      }
    }

    const averageError = validPoints > 0 ? totalError / validPoints : 50;
    
    // Set gaze accuracy threshold based on calibration performance
    // Better calibration = tighter threshold
    const gazeAccuracy = Math.max(30, Math.min(100, averageError * 1.5));
    
    // Set confidence threshold based on calibration data quality
    const avgConfidence = this.calibrationData.reduce((sum, d) => sum + d.confidence, 0) / this.calibrationData.length;
    const confidenceThreshold = Math.max(0.6, avgConfidence - 0.1);

    return { gazeAccuracy, confidenceThreshold };
  }

  /**
   * Calculate calibration quality score
   */
  calculateQuality(): CalibrationQuality {
    if (this.calibrationData.length === 0) {
      return {
        gazeAccuracy: 0,
        headPoseRange: 0,
        environmentStability: 0,
        overall: 0,
        recommendations: ['No calibration data available']
      };
    }

    // Calculate gaze accuracy
    const gazeAccuracy = this.calculateGazeAccuracy();
    
    // Calculate head pose range coverage
    const headPoseRange = this.calculateHeadPoseRange();
    
    // Calculate environment stability (mock for now)
    const environmentStability = 0.8; // Will be enhanced in task 4.3
    
    // Calculate overall quality
    const overall = (gazeAccuracy * 0.5 + headPoseRange * 0.3 + environmentStability * 0.2);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(gazeAccuracy, headPoseRange, environmentStability);

    return {
      gazeAccuracy,
      headPoseRange,
      environmentStability,
      overall,
      recommendations
    };
  }

  /**
   * Calculate gaze accuracy score (0-1)
   */
  private calculateGazeAccuracy(): number {
    if (this.calibrationData.length === 0) return 0;

    let totalError = 0;
    let validPoints = 0;

    for (const data of this.calibrationData) {
      if (data.confidence > 0.5) {
        const predicted = this.transformPoint(data.screenPoint.x, data.screenPoint.y);
        const actual = [data.gazePoint.x, data.gazePoint.y];
        
        const error = Math.sqrt(
          Math.pow(predicted[0] - actual[0], 2) + 
          Math.pow(predicted[1] - actual[1], 2)
        );
        
        totalError += error;
        validPoints++;
      }
    }

    if (validPoints === 0) return 0;

    const averageError = totalError / validPoints;
    
    // Convert error to quality score (lower error = higher quality)
    // Assume 20px error = 1.0 quality, 100px error = 0.0 quality
    return Math.max(0, Math.min(1, (100 - averageError) / 80));
  }

  /**
   * Calculate head pose range coverage (0-1)
   */
  private calculateHeadPoseRange(): number {
    if (this.calibrationData.length === 0) return 0;

    const yawValues = this.calibrationData.map(d => d.headPose.yaw);
    const pitchValues = this.calibrationData.map(d => d.headPose.pitch);

    const yawRange = Math.max(...yawValues) - Math.min(...yawValues);
    const pitchRange = Math.max(...pitchValues) - Math.min(...pitchValues);

    // Good calibration should cover at least 20 degrees in each direction
    const yawScore = Math.min(1, yawRange / 40);
    const pitchScore = Math.min(1, pitchRange / 30);

    return (yawScore + pitchScore) / 2;
  }

  /**
   * Generate quality recommendations
   */
  private generateRecommendations(gazeAccuracy: number, headPoseRange: number, environmentStability: number): string[] {
    const recommendations: string[] = [];

    if (gazeAccuracy < 0.8) {
      recommendations.push('Look directly at each calibration point');
      recommendations.push('Keep your head still during gaze calibration');
      recommendations.push('Ensure your eyes are clearly visible to the camera');
    }

    if (headPoseRange < 0.6) {
      recommendations.push('Move your head through a wider range during head pose calibration');
      recommendations.push('Ensure you complete all head movement directions');
    }

    if (environmentStability < 0.7) {
      recommendations.push('Improve lighting conditions');
      recommendations.push('Remove distracting objects from the camera view');
      recommendations.push('Ensure stable positioning');
    }

    if (recommendations.length === 0) {
      recommendations.push('Calibration quality is excellent!');
    }

    return recommendations;
  }

  /**
   * Check if calibration meets minimum quality threshold
   */
  meetsQualityThreshold(): boolean {
    const quality = this.calculateQuality();
    return quality.overall >= this.qualityThreshold;
  }

  /**
   * Get calibration results for profile creation
   */
  getCalibrationResults() {
    return {
      homographyMatrix: this.homographyMatrix,
      biasVector: this.biasVector,
      personalThresholds: this.calculatePersonalThresholds(),
      quality: this.calculateQuality(),
      dataPoints: this.calibrationData.length
    };
  }
}