import '@testing-library/jest-dom'
import { toHaveNoViolations } from 'jest-axe'

// Extend Jest matchers
expect.extend({ toHaveNoViolations })

// Mock MediaPipe modules globally
global.MediaPipe = {
  FaceMesh: jest.fn(),
  Camera: jest.fn(),
}

// Mock HTMLVideoElement methods
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  writable: true,
  value: jest.fn().mockImplementation(() => Promise.resolve()),
})

Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
  writable: true,
  value: jest.fn(),
})

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockImplementation(() => 
      Promise.resolve({
        getTracks: () => [{ stop: jest.fn() }],
      })
    ),
  },
})

// Mock performance.now for consistent timing in tests
global.performance.now = jest.fn(() => Date.now())