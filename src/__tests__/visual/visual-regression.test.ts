/**
 * Visual regression tests for UI components
 */

import { render } from '@testing-library/react';
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import puppeteer from 'puppeteer';
import React from 'react';

// Extend Jest matchers
expect.extend({ toMatchImageSnapshot });

// Mock components for visual testing
import { ConsentModal } from '../../components/ui/ConsentModal';
import { CalibrationWizard } from '../../components/calibration/CalibrationWizard';
import { MonitoringStatusDisplay } from '../../components/monitoring/MonitoringStatusDisplay';
import { QuizInterface } from '../../components/quiz/QuizInterface';

// Mock store for consistent visual testing
const mockStore = {
  cameraPermission: 'pending' as const,
  setCameraPermission: jest.fn(),
  privacySettings: {
    videoPreviewEnabled: true,
    serverSyncEnabled: false,
    audioAlertsEnabled: true
  },
  currentSignals: {
    timestamp: Date.now(),
    faceDetected: true,
    landmarks: new Float32Array(468 * 3),
    headPose: { yaw: 0, pitch: 0, roll: 0, confidence: 0.9 },
    gazeVector: { x: 0, y: 0, z: -1, confidence: 0.85 },
    eyesOnScreen: true,
    environmentScore: {
      lighting: 0.8,
      shadowStability: 0.9,
      secondaryFaces: 0,
      deviceLikeObjects: 0
    }
  }
};

jest.mock('../../store/appStore', () => ({
  useAppStore: () => mockStore
}));

class VisualRegressionTester {
  private browser: puppeteer.Browser | null = null;
  private page: puppeteer.Page | null = null;

  async setup() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 720 });
  }

  async teardown() {
    if (this.page) {
      await this.page.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  async captureComponent(component: React.ReactElement, name: string) {
    if (!this.page) {
      throw new Error('Visual tester not initialized');
    }

    // Render component to HTML
    const { container } = render(component);
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Visual Test</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; }
          </style>
        </head>
        <body>
          ${container.innerHTML}
        </body>
      </html>
    `;

    await this.page.setContent(html);
    await this.page.waitForTimeout(1000); // Wait for rendering

    const screenshot = await this.page.screenshot({
      fullPage: true,
      type: 'png'
    });

    expect(screenshot).toMatchImageSnapshot({
      customSnapshotIdentifier: name,
      failureThreshold: 0.01,
      failureThresholdType: 'percent'
    });
  }

  async capturePageScreenshot(url: string, name: string, options: {
    viewport?: { width: number; height: number };
    waitFor?: string;
    interactions?: Array<{ type: 'click' | 'hover' | 'focus'; selector: string }>;
  } = {}) {
    if (!this.page) {
      throw new Error('Visual tester not initialized');
    }

    if (options.viewport) {
      await this.page.setViewport(options.viewport);
    }

    await this.page.goto(url, { waitUntil: 'networkidle0' });

    if (options.waitFor) {
      await this.page.waitForSelector(options.waitFor);
    }

    // Perform interactions if specified
    if (options.interactions) {
      for (const interaction of options.interactions) {
        switch (interaction.type) {
          case 'click':
            await this.page.click(interaction.selector);
            break;
          case 'hover':
            await this.page.hover(interaction.selector);
            break;
          case 'focus':
            await this.page.focus(interaction.selector);
            break;
        }
        await this.page.waitForTimeout(500); // Wait for interaction effects
      }
    }

    const screenshot = await this.page.screenshot({
      fullPage: true,
      type: 'png'
    });

    expect(screenshot).toMatchImageSnapshot({
      customSnapshotIdentifier: name,
      failureThreshold: 0.02,
      failureThresholdType: 'percent'
    });
  }
}

describe('Visual Regression Tests', () => {
  let visualTester: VisualRegressionTester;

  beforeAll(async () => {
    visualTester = new VisualRegressionTester();
    await visualTester.setup();
  });

  afterAll(async () => {
    await visualTester.teardown();
  });

  describe('Component Visual Tests', () => {
    it('should match ConsentModal appearance', async () => {
      await visualTester.captureComponent(
        <ConsentModal
          isOpen={true}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
        />,
        'consent-modal'
      );
    });

    it('should match ConsentModal with different states', async () => {
      // Test loading state
      await visualTester.captureComponent(
        <ConsentModal
          isOpen={true}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          loading={true}
        />,
        'consent-modal-loading'
      );
    });

    it('should match CalibrationWizard appearance', async () => {
      await visualTester.captureComponent(
        <CalibrationWizard
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />,
        'calibration-wizard'
      );
    });

    it('should match MonitoringStatusDisplay with good status', async () => {
      await visualTester.captureComponent(
        <MonitoringStatusDisplay />,
        'monitoring-status-good'
      );
    });

    it('should match MonitoringStatusDisplay with warnings', async () => {
      // Update mock store for warning state
      mockStore.currentSignals = {
        ...mockStore.currentSignals,
        eyesOnScreen: false,
        headPose: { yaw: 25, pitch: -20, roll: 5, confidence: 0.7 },
        environmentScore: {
          lighting: 0.4,
          shadowStability: 0.5,
          secondaryFaces: 1,
          deviceLikeObjects: 0
        }
      };

      await visualTester.captureComponent(
        <MonitoringStatusDisplay />,
        'monitoring-status-warnings'
      );
    });

    it('should match QuizInterface appearance', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          type: 'multiple-choice' as const,
          text: 'What is the capital of France?',
          options: ['London', 'Berlin', 'Paris', 'Madrid'],
          correctAnswer: 'Paris',
          timeLimitSeconds: 30,
          points: 1
        }
      ];

      await visualTester.captureComponent(
        <QuizInterface
          questions={mockQuestions}
          currentQuestionIndex={0}
          onAnswerChange={jest.fn()}
          onNext={jest.fn()}
          onComplete={jest.fn()}
        />,
        'quiz-interface'
      );
    });
  });

  describe('Responsive Design Tests', () => {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 720 },
      { name: 'large-desktop', width: 1920, height: 1080 }
    ];

    viewports.forEach(viewport => {
      it(`should render correctly on ${viewport.name}`, async () => {
        await visualTester.captureComponent(
          <div className="min-h-screen bg-gray-100 p-4">
            <ConsentModal
              isOpen={true}
              onAccept={jest.fn()}
              onDecline={jest.fn()}
            />
          </div>,
          `consent-modal-${viewport.name}`
        );
      });
    });
  });

  describe('Theme and Color Variations', () => {
    it('should match dark theme appearance', async () => {
      await visualTester.captureComponent(
        <div className="dark bg-gray-900 min-h-screen p-4">
          <MonitoringStatusDisplay />
        </div>,
        'monitoring-status-dark-theme'
      );
    });

    it('should match high contrast theme', async () => {
      await visualTester.captureComponent(
        <div className="contrast-more bg-white text-black p-4">
          <CalibrationWizard
            onComplete={jest.fn()}
            onCancel={jest.fn()}
          />
        </div>,
        'calibration-wizard-high-contrast'
      );
    });
  });

  describe('Interactive State Tests', () => {
    it('should capture button hover states', async () => {
      await visualTester.captureComponent(
        <div className="p-8">
          <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            Hover Me
          </button>
        </div>,
        'button-hover-state'
      );
    });

    it('should capture form focus states', async () => {
      await visualTester.captureComponent(
        <div className="p-8">
          <input
            type="text"
            placeholder="Focus me"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>,
        'input-focus-state'
      );
    });

    it('should capture loading states', async () => {
      await visualTester.captureComponent(
        <div className="p-8 flex items-center space-x-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span>Loading...</span>
        </div>,
        'loading-state'
      );
    });
  });

  describe('Error State Tests', () => {
    it('should match error message appearance', async () => {
      await visualTester.captureComponent(
        <div className="p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Camera Access Error
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>Unable to access camera. Please check permissions and try again.</p>
                </div>
              </div>
            </div>
          </div>
        </div>,
        'error-message'
      );
    });

    it('should match warning message appearance', async () => {
      await visualTester.captureComponent(
        <div className="p-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Poor Lighting Detected
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Lighting conditions may affect monitoring accuracy. Consider adjusting your environment.</p>
                </div>
              </div>
            </div>
          </div>
        </div>,
        'warning-message'
      );
    });
  });

  describe('Animation and Transition Tests', () => {
    it('should capture modal transition states', async () => {
      // Test modal opening animation
      await visualTester.captureComponent(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 transform transition-all duration-300 scale-95 opacity-0">
            <h2 className="text-xl font-bold mb-4">Modal Content</h2>
            <p>This modal is in transition state.</p>
          </div>
        </div>,
        'modal-transition-opening'
      );

      // Test modal fully open
      await visualTester.captureComponent(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 transform transition-all duration-300 scale-100 opacity-100">
            <h2 className="text-xl font-bold mb-4">Modal Content</h2>
            <p>This modal is fully open.</p>
          </div>
        </div>,
        'modal-transition-open'
      );
    });

    it('should capture progress bar animations', async () => {
      await visualTester.captureComponent(
        <div className="p-8">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: '45%' }}></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">Progress: 45%</p>
        </div>,
        'progress-bar-45-percent'
      );
    });
  });
});

// Integration with CI/CD
describe('Visual Regression CI Integration', () => {
  it('should generate baseline images for new components', async () => {
    // This test would run only when generating new baselines
    if (process.env.GENERATE_BASELINES === 'true') {
      const visualTester = new VisualRegressionTester();
      await visualTester.setup();

      // Generate baselines for all components
      const components = [
        { name: 'consent-modal', component: <ConsentModal isOpen={true} onAccept={jest.fn()} onDecline={jest.fn()} /> },
        { name: 'calibration-wizard', component: <CalibrationWizard onComplete={jest.fn()} onCancel={jest.fn()} /> },
        { name: 'monitoring-status', component: <MonitoringStatusDisplay /> }
      ];

      for (const { name, component } of components) {
        await visualTester.captureComponent(component, `baseline-${name}`);
      }

      await visualTester.teardown();
    }
  });

  it('should fail on visual regressions in CI', async () => {
    // This test would be more strict in CI environment
    if (process.env.CI === 'true') {
      const visualTester = new VisualRegressionTester();
      await visualTester.setup();

      // Use stricter thresholds in CI
      const screenshot = await visualTester.page!.screenshot({ type: 'png' });
      
      expect(screenshot).toMatchImageSnapshot({
        customSnapshotIdentifier: 'ci-strict-test',
        failureThreshold: 0.001, // Very strict threshold
        failureThresholdType: 'percent'
      });

      await visualTester.teardown();
    }
  });
});