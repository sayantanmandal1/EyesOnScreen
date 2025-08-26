#!/usr/bin/env node

/**
 * Performance benchmarking and monitoring script
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class PerformanceBenchmark {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage()
      },
      benchmarks: {},
      baselines: this.loadBaselines(),
      regressions: []
    };
  }

  loadBaselines() {
    const baselinePath = path.join(__dirname, '../performance-baselines.json');
    if (fs.existsSync(baselinePath)) {
      return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    }
    return {};
  }

  saveBaselines() {
    const baselinePath = path.join(__dirname, '../performance-baselines.json');
    fs.writeFileSync(baselinePath, JSON.stringify(this.results.baselines, null, 2));
  }

  async measureAsync(name, fn, iterations = 100) {
    const measurements = [];
    
    console.log(`📊 Benchmarking ${name} (${iterations} iterations)...`);
    
    // Warmup
    for (let i = 0; i < Math.min(10, iterations); i++) {
      await fn();
    }

    // Actual measurements
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      measurements.push(end - start);
      
      if (i % Math.floor(iterations / 10) === 0) {
        process.stdout.write('.');
      }
    }
    
    console.log(' Done!');
    
    const stats = this.calculateStats(measurements);
    this.results.benchmarks[name] = stats;
    
    // Check for regressions
    this.checkRegression(name, stats);
    
    return stats;
  }

  measureSync(name, fn, iterations = 1000) {
    const measurements = [];
    
    console.log(`📊 Benchmarking ${name} (${iterations} iterations)...`);
    
    // Warmup
    for (let i = 0; i < Math.min(100, iterations); i++) {
      fn();
    }

    // Actual measurements
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      measurements.push(end - start);
      
      if (i % Math.floor(iterations / 10) === 0) {
        process.stdout.write('.');
      }
    }
    
    console.log(' Done!');
    
    const stats = this.calculateStats(measurements);
    this.results.benchmarks[name] = stats;
    
    // Check for regressions
    this.checkRegression(name, stats);
    
    return stats;
  }

  calculateStats(measurements) {
    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);
    
    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      mean: sum / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(
        measurements.reduce((sq, n) => sq + Math.pow(n - (sum / measurements.length), 2), 0) / 
        (measurements.length - 1)
      )
    };
  }

  checkRegression(name, stats) {
    const baseline = this.results.baselines[name];
    if (!baseline) {
      console.log(`📝 No baseline for ${name}, setting current as baseline`);
      this.results.baselines[name] = stats;
      return;
    }

    const regressionThreshold = 1.2; // 20% slower is considered a regression
    const improvementThreshold = 0.8; // 20% faster is considered an improvement

    const meanRatio = stats.mean / baseline.mean;
    const p95Ratio = stats.p95 / baseline.p95;

    if (meanRatio > regressionThreshold || p95Ratio > regressionThreshold) {
      const regression = {
        benchmark: name,
        type: 'regression',
        meanChange: ((meanRatio - 1) * 100).toFixed(1),
        p95Change: ((p95Ratio - 1) * 100).toFixed(1),
        current: stats,
        baseline: baseline
      };
      
      this.results.regressions.push(regression);
      console.log(`🚨 Performance regression detected in ${name}:`);
      console.log(`   Mean: ${regression.meanChange}% slower`);
      console.log(`   P95: ${regression.p95Change}% slower`);
    } else if (meanRatio < improvementThreshold && p95Ratio < improvementThreshold) {
      console.log(`🚀 Performance improvement in ${name}:`);
      console.log(`   Mean: ${((1 - meanRatio) * 100).toFixed(1)}% faster`);
      console.log(`   P95: ${((1 - p95Ratio) * 100).toFixed(1)}% faster`);
      
      // Update baseline with improved performance
      this.results.baselines[name] = stats;
    }
  }

  // Benchmark synthetic workloads
  async runSyntheticBenchmarks() {
    console.log('\n🔬 Running synthetic benchmarks...\n');

    // CPU-intensive task
    this.measureSync('cpu-intensive', () => {
      let result = 0;
      for (let i = 0; i < 10000; i++) {
        result += Math.sin(i) * Math.cos(i);
      }
      return result;
    }, 1000);

    // Memory allocation
    this.measureSync('memory-allocation', () => {
      const arrays = [];
      for (let i = 0; i < 100; i++) {
        arrays.push(new Float32Array(1000));
      }
      return arrays.length;
    }, 500);

    // Array operations
    this.measureSync('array-operations', () => {
      const arr = Array.from({ length: 1000 }, (_, i) => i);
      return arr.map(x => x * 2).filter(x => x % 3 === 0).reduce((a, b) => a + b, 0);
    }, 500);

    // Object creation and manipulation
    this.measureSync('object-operations', () => {
      const objects = [];
      for (let i = 0; i < 100; i++) {
        objects.push({
          id: i,
          name: `Object ${i}`,
          data: Array.from({ length: 10 }, (_, j) => ({ value: i * j }))
        });
      }
      return objects.filter(obj => obj.id % 2 === 0).length;
    }, 500);

    // JSON serialization/deserialization
    this.measureSync('json-operations', () => {
      const data = {
        timestamp: Date.now(),
        values: Array.from({ length: 100 }, (_, i) => ({ id: i, value: Math.random() }))
      };
      const serialized = JSON.stringify(data);
      const deserialized = JSON.parse(serialized);
      return deserialized.values.length;
    }, 500);

    // Promise resolution
    await this.measureAsync('promise-resolution', async () => {
      const promises = Array.from({ length: 10 }, () => 
        Promise.resolve(Math.random())
      );
      const results = await Promise.all(promises);
      return results.length;
    }, 100);

    // Timeout simulation
    await this.measureAsync('timeout-simulation', async () => {
      return new Promise(resolve => setTimeout(resolve, 1));
    }, 50);
  }

  // Benchmark application-specific operations
  async runApplicationBenchmarks() {
    console.log('\n🎯 Running application-specific benchmarks...\n');

    // Simulate face landmark processing
    this.measureSync('landmark-processing', () => {
      const landmarks = new Float32Array(468 * 3);
      for (let i = 0; i < 468; i++) {
        landmarks[i * 3] = Math.random() * 640;
        landmarks[i * 3 + 1] = Math.random() * 480;
        landmarks[i * 3 + 2] = Math.random() * 10;
      }
      
      // Simulate processing
      let sum = 0;
      for (let i = 0; i < landmarks.length; i++) {
        sum += landmarks[i] * landmarks[i];
      }
      
      return Math.sqrt(sum);
    }, 1000);

    // Simulate gaze vector calculation
    this.measureSync('gaze-calculation', () => {
      const eyePoints = Array.from({ length: 12 }, () => ({
        x: Math.random() * 640,
        y: Math.random() * 480,
        z: Math.random() * 10
      }));
      
      // Simulate gaze vector calculation
      const center = eyePoints.reduce((acc, point) => ({
        x: acc.x + point.x / eyePoints.length,
        y: acc.y + point.y / eyePoints.length,
        z: acc.z + point.z / eyePoints.length
      }), { x: 0, y: 0, z: 0 });
      
      return Math.sqrt(center.x * center.x + center.y * center.y + center.z * center.z);
    }, 1000);

    // Simulate signal processing
    this.measureSync('signal-processing', () => {
      const signals = Array.from({ length: 100 }, () => ({
        timestamp: Date.now(),
        value: Math.random(),
        confidence: Math.random()
      }));
      
      // Apply filtering
      const filtered = signals
        .filter(s => s.confidence > 0.5)
        .map(s => ({ ...s, smoothed: s.value * 0.7 + Math.random() * 0.3 }));
      
      return filtered.length;
    }, 500);

    // Simulate data export
    this.measureSync('data-export', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: Date.now() + i * 100,
        questionId: `q${Math.floor(i / 100)}`,
        eyesOn: Math.random() > 0.2,
        gazeConfidence: Math.random(),
        headPose: {
          yaw: Math.random() * 40 - 20,
          pitch: Math.random() * 30 - 15,
          roll: Math.random() * 10 - 5
        }
      }));
      
      // Convert to CSV format
      const headers = ['timestamp', 'questionId', 'eyesOn', 'gazeConfidence', 'yaw', 'pitch', 'roll'];
      const csv = [
        headers.join(','),
        ...data.map(row => [
          row.timestamp,
          row.questionId,
          row.eyesOn,
          row.gazeConfidence,
          row.headPose.yaw,
          row.headPose.pitch,
          row.headPose.roll
        ].join(','))
      ].join('\n');
      
      return csv.length;
    }, 100);
  }

  generateReport() {
    const reportPath = path.join(process.cwd(), 'benchmark-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    console.log('\n📊 Performance Benchmark Report:');
    console.log('=================================\n');
    
    Object.entries(this.results.benchmarks).forEach(([name, stats]) => {
      console.log(`📈 ${name}:`);
      console.log(`   Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`   Median: ${stats.median.toFixed(2)}ms`);
      console.log(`   P95: ${stats.p95.toFixed(2)}ms`);
      console.log(`   Min/Max: ${stats.min.toFixed(2)}ms / ${stats.max.toFixed(2)}ms`);
      console.log(`   Std Dev: ${stats.stdDev.toFixed(2)}ms\n`);
    });

    if (this.results.regressions.length > 0) {
      console.log('🚨 Performance Regressions Detected:');
      this.results.regressions.forEach(regression => {
        console.log(`   ${regression.benchmark}: ${regression.meanChange}% slower (mean)`);
      });
      console.log('');
    } else {
      console.log('✅ No performance regressions detected!\n');
    }

    console.log(`📄 Full report saved to: ${reportPath}`);
    
    // Save updated baselines
    this.saveBaselines();
    
    return this.results;
  }

  async run() {
    console.log('🚀 Starting performance benchmarks...\n');
    
    await this.runSyntheticBenchmarks();
    await this.runApplicationBenchmarks();
    
    const report = this.generateReport();
    
    // Exit with error code if regressions detected
    if (this.results.regressions.length > 0 && process.env.CI) {
      console.log('\n💥 Performance regressions detected in CI environment');
      process.exit(1);
    }
    
    console.log('\n🎉 Benchmarking complete!');
    return report;
  }
}

// CLI interface
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.run().catch(error => {
    console.error('💥 Benchmark failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceBenchmark;