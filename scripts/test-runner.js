#!/usr/bin/env node

/**
 * Automated test runner with performance monitoring and reporting
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        ci: !!process.env.CI
      },
      tests: {},
      performance: {},
      coverage: {},
      errors: []
    };
  }

  async runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      console.log(`\n🚀 Running: ${command}`);
      
      const child = spawn('npm', ['run', command], {
        stdio: 'pipe',
        shell: true,
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (!options.silent) {
          process.stdout.write(data);
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if (!options.silent) {
          process.stderr.write(data);
        }
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        const result = {
          command,
          exitCode: code,
          duration,
          stdout,
          stderr,
          success: code === 0
        };

        if (code === 0) {
          console.log(`✅ ${command} completed in ${duration}ms`);
          resolve(result);
        } else {
          console.log(`❌ ${command} failed with exit code ${code}`);
          reject(result);
        }
      });

      child.on('error', (error) => {
        console.error(`💥 Failed to start ${command}:`, error);
        reject({ command, error: error.message, success: false });
      });
    });
  }

  async runUnitTests() {
    try {
      const result = await this.runCommand('test:unit -- --coverage --watchAll=false --json --outputFile=test-results.json');
      
      // Parse test results
      if (fs.existsSync('test-results.json')) {
        const testResults = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
        this.results.tests.unit = {
          success: testResults.success,
          numTotalTests: testResults.numTotalTests,
          numPassedTests: testResults.numPassedTests,
          numFailedTests: testResults.numFailedTests,
          testResults: testResults.testResults
        };
      }

      // Parse coverage results
      if (fs.existsSync('coverage/coverage-summary.json')) {
        const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
        this.results.coverage = coverage.total;
      }

      return result;
    } catch (error) {
      this.results.errors.push({ type: 'unit-tests', error: error.message });
      throw error;
    }
  }

  async runIntegrationTests() {
    try {
      const result = await this.runCommand('test:integration -- --watchAll=false');
      this.results.tests.integration = { success: result.success };
      return result;
    } catch (error) {
      this.results.errors.push({ type: 'integration-tests', error: error.message });
      throw error;
    }
  }

  async runAccessibilityTests() {
    try {
      const result = await this.runCommand('test:a11y -- --watchAll=false');
      this.results.tests.accessibility = { success: result.success };
      return result;
    } catch (error) {
      this.results.errors.push({ type: 'accessibility-tests', error: error.message });
      throw error;
    }
  }

  async runPerformanceTests() {
    try {
      const result = await this.runCommand('test:performance -- --watchAll=false');
      this.results.tests.performance = { success: result.success };
      
      // Extract performance metrics from output
      const performanceRegex = /Performance: (\w+) - (\d+\.?\d*)ms/g;
      let match;
      const metrics = {};
      
      while ((match = performanceRegex.exec(result.stdout)) !== null) {
        metrics[match[1]] = parseFloat(match[2]);
      }
      
      this.results.performance = metrics;
      return result;
    } catch (error) {
      this.results.errors.push({ type: 'performance-tests', error: error.message });
      throw error;
    }
  }

  async runVisualRegressionTests() {
    try {
      const result = await this.runCommand('test:visual');
      this.results.tests.visual = { success: result.success };
      return result;
    } catch (error) {
      this.results.errors.push({ type: 'visual-tests', error: error.message });
      throw error;
    }
  }

  async runLinting() {
    try {
      const result = await this.runCommand('lint');
      this.results.tests.lint = { success: result.success };
      return result;
    } catch (error) {
      this.results.errors.push({ type: 'linting', error: error.message });
      throw error;
    }
  }

  async runTypeChecking() {
    try {
      const result = await this.runCommand('type-check');
      this.results.tests.typeCheck = { success: result.success };
      return result;
    } catch (error) {
      this.results.errors.push({ type: 'type-check', error: error.message });
      throw error;
    }
  }

  async runSecurityAudit() {
    try {
      const result = await this.runCommand('audit');
      this.results.tests.security = { success: result.success };
      return result;
    } catch (error) {
      this.results.errors.push({ type: 'security-audit', error: error.message });
      // Don't throw for security audit failures in development
      if (!process.env.CI) {
        console.warn('⚠️  Security audit failed, but continuing in development mode');
        return { success: false };
      }
      throw error;
    }
  }

  generateReport() {
    const reportPath = path.join(process.cwd(), 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    console.log('\n📊 Test Report Summary:');
    console.log('========================');
    
    Object.entries(this.results.tests).forEach(([testType, result]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${testType}: ${result.success ? 'PASSED' : 'FAILED'}`);
    });

    if (this.results.coverage.lines) {
      console.log(`\n📈 Coverage: ${this.results.coverage.lines.pct}% lines, ${this.results.coverage.statements.pct}% statements`);
    }

    if (Object.keys(this.results.performance).length > 0) {
      console.log('\n⚡ Performance Metrics:');
      Object.entries(this.results.performance).forEach(([metric, value]) => {
        console.log(`   ${metric}: ${value}ms`);
      });
    }

    if (this.results.errors.length > 0) {
      console.log('\n🚨 Errors:');
      this.results.errors.forEach(error => {
        console.log(`   ${error.type}: ${error.error}`);
      });
    }

    console.log(`\n📄 Full report saved to: ${reportPath}`);
    
    return this.results;
  }

  async runAll() {
    console.log('🧪 Starting comprehensive test suite...\n');
    
    const tests = [
      { name: 'Linting', fn: () => this.runLinting() },
      { name: 'Type Checking', fn: () => this.runTypeChecking() },
      { name: 'Unit Tests', fn: () => this.runUnitTests() },
      { name: 'Integration Tests', fn: () => this.runIntegrationTests() },
      { name: 'Accessibility Tests', fn: () => this.runAccessibilityTests() },
      { name: 'Performance Tests', fn: () => this.runPerformanceTests() },
      { name: 'Security Audit', fn: () => this.runSecurityAudit() }
    ];

    // Add visual regression tests if not in CI (requires display)
    if (!process.env.CI) {
      tests.push({ name: 'Visual Regression Tests', fn: () => this.runVisualRegressionTests() });
    }

    let allPassed = true;

    for (const test of tests) {
      try {
        console.log(`\n🔄 Running ${test.name}...`);
        await test.fn();
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error.message);
        allPassed = false;
        
        // Continue with other tests unless it's a critical failure
        if (test.name === 'Unit Tests' && process.env.CI) {
          break; // Stop on unit test failures in CI
        }
      }
    }

    const report = this.generateReport();
    
    if (!allPassed) {
      console.log('\n💥 Some tests failed. Check the report for details.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    }
  }
}

// CLI interface
if (require.main === module) {
  const runner = new TestRunner();
  const command = process.argv[2];

  switch (command) {
    case 'unit':
      runner.runUnitTests().then(() => runner.generateReport()).catch(() => process.exit(1));
      break;
    case 'integration':
      runner.runIntegrationTests().then(() => runner.generateReport()).catch(() => process.exit(1));
      break;
    case 'a11y':
      runner.runAccessibilityTests().then(() => runner.generateReport()).catch(() => process.exit(1));
      break;
    case 'performance':
      runner.runPerformanceTests().then(() => runner.generateReport()).catch(() => process.exit(1));
      break;
    case 'visual':
      runner.runVisualRegressionTests().then(() => runner.generateReport()).catch(() => process.exit(1));
      break;
    case 'all':
    default:
      runner.runAll();
      break;
  }
}

module.exports = TestRunner;