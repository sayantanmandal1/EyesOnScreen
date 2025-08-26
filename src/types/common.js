/**
 * Common type definitions for the application
 * Converted from TypeScript to JavaScript with JSDoc type definitions
 */

/**
 * Generic event handler type
 * @typedef {function(Event): void} EventHandler
 * @template T
 * @param {T} event - The event object
 * @returns {void}
 */

/**
 * Generic callback type
 * @typedef {function(): T} Callback
 * @template T
 * @returns {T}
 */

/**
 * Generic data object type
 * @typedef {Object.<string, *>} DataObject
 */

/**
 * MediaPipe landmark point
 * @typedef {Object} MediaPipeLandmark
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate  
 * @property {number} z - Z coordinate
 */

/**
 * MediaPipe result types
 * @typedef {Object} MediaPipeResults
 * @property {MediaPipeLandmark[][]} [multiFaceLandmarks] - Array of face landmark arrays
 * @property {HTMLCanvasElement|HTMLImageElement} [image] - Result image
 */

/**
 * Canvas context type
 * @typedef {CanvasRenderingContext2D} CanvasContext
 */

/**
 * Generic configuration object
 * @typedef {Object.<string, *>} ConfigObject
 */

/**
 * API response type
 * @typedef {Object} ApiResponse
 * @template T
 * @property {boolean} success - Whether the request was successful
 * @property {T} [data] - Response data
 * @property {string} [error] - Error message if unsuccessful
 */

/**
 * File export options
 * @typedef {Object} ExportOptions
 * @property {string} [format] - Export format
 * @property {boolean} [compression] - Whether to compress
 * @property {*} [key] - Additional options
 */

/**
 * Generic error with details
 * @typedef {Error & {details?: *}} ErrorWithDetails
 */

// Export empty object since this is now a types-only file
export {};