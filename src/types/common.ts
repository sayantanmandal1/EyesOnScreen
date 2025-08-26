/**
 * Common type definitions for the application
 */

// Generic event handler type
export type EventHandler<T = Event> = (event: T) => void;

// Generic callback type
export type Callback<T = void> = () => T;

// Generic data object type
export interface DataObject {
  [key: string]: unknown;
}

// MediaPipe result types
export interface MediaPipeResults {
  multiFaceLandmarks?: Array<{
    x: number;
    y: number;
    z: number;
  }[]>;
  image?: HTMLCanvasElement | HTMLImageElement;
}

// Canvas context type
export type CanvasContext = CanvasRenderingContext2D;

// Generic configuration object
export interface ConfigObject {
  [key: string]: unknown;
}

// API response type
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// File export options
export interface ExportOptions {
  format?: string;
  compression?: boolean;
  [key: string]: unknown;
}

// Generic error with details
export interface ErrorWithDetails extends Error {
  details?: unknown;
}