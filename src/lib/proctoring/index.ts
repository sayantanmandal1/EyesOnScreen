// Proctoring module exports
export * from './types';
export { ProctorEngine } from './ProctorEngine';
export { TemporalFilterSystem } from './TemporalFilterSystem';
export { SignalProcessor } from './SignalProcessor';
export { KalmanFilter, VectorKalmanFilter } from './filters/KalmanFilter';
export { ExponentialMovingAverage, VectorExponentialMovingAverage } from './filters/ExponentialMovingAverage';
export { CircularBuffer } from './filters/CircularBuffer';
export { OutlierDetector } from './filters/OutlierDetector';