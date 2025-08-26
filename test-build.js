#!/usr/bin/env node

/**
 * Test script to verify the build process works correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔧 Testing build process...\n');

try {
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    throw new Error('package.json not found');
  }

  console.log('📦 Installing dependencies...');
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });

  console.log('\n🔍 Running type check...');
  execSync('npm run type-check', { stdio: 'inherit' });

  console.log('\n🧪 Running linting...');
  execSync('npm run lint', { stdio: 'inherit' });

  console.log('\n🏗️ Building application...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('\n✅ All checks passed! The build is working correctly.');

} catch (error) {
  console.error('\n❌ Build test failed:', error.message);
  process.exit(1);
}