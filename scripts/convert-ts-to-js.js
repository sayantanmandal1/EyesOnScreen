#!/usr/bin/env node

/**
 * Automated TypeScript to JavaScript Converter
 * This script converts TypeScript files to JavaScript by removing type annotations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SRC_DIR = './src';
const EXCLUDE_PATTERNS = [
  'node_modules',
  'coverage',
  '.git',
  'dist',
  'build'
];

// Files to keep as TypeScript (Next.js app router)
const KEEP_TS_FILES = [
  'src/app/layout.tsx',
  'src/app/page.tsx'
];

/**
 * Convert TypeScript syntax to JavaScript
 */
function convertTsToJs(content) {
  let converted = content;
  
  // Remove type annotations from function parameters
  converted = converted.replace(/(\w+):\s*[A-Za-z_$][\w<>[\]|&,\s]*(?=\s*[,)])/g, '$1');
  
  // Remove return type annotations
  converted = converted.replace(/\):\s*[A-Za-z_$][\w<>[\]|&,\s]*(?=\s*[{=])/g, ')');
  
  // Remove variable type annotations
  converted = converted.replace(/:\s*[A-Za-z_$][\w<>[\]|&,\s]*(?=\s*[=;,)])/g, '');
  
  // Remove interface declarations (convert to JSDoc)
  converted = converted.replace(/export\s+interface\s+(\w+)\s*{([^}]*)}/g, (match, name, body) => {
    const fields = body.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'))
      .map(line => {
        const [prop, type] = line.split(':');
        if (prop && type) {
          return ` * @property {${type.trim().replace(/;$/, '')}} ${prop.trim()}`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
    
    return `/**\n * @typedef {Object} ${name}\n${fields}\n */`;
  });
  
  // Remove type imports
  converted = converted.replace(/import\s+type\s+{[^}]*}\s+from\s+['"'][^'"]*['"];?\n?/g, '');
  
  // Remove generic type parameters
  converted = converted.replace(/<[A-Za-z_$][\w<>[\]|&,\s]*>/g, '');
  
  // Remove type assertions
  converted = converted.replace(/\s+as\s+[A-Za-z_$][\w<>[\]|&,\s]*/g, '');
  
  // Remove 'as const' assertions
  converted = converted.replace(/\s+as\s+const/g, '');
  
  // Remove enum declarations (convert to objects)
  converted = converted.replace(/export\s+enum\s+(\w+)\s*{([^}]*)}/g, (match, name, body) => {
    const entries = body.split(',')
      .map(entry => entry.trim())
      .filter(entry => entry)
      .map(entry => {
        if (entry.includes('=')) {
          return entry;
        } else {
          return `${entry}: '${entry}'`;
        }
      })
      .join(',\n  ');
    
    return `export const ${name} = {\n  ${entries}\n};`;
  });
  
  return converted;
}

/**
 * Get all TypeScript files recursively
 */
function getTsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!EXCLUDE_PATTERNS.some(pattern => entry.includes(pattern))) {
        getTsFiles(fullPath, files);
      }
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      const relativePath = path.relative('.', fullPath);
      if (!KEEP_TS_FILES.includes(relativePath.replace(/\\/g, '/'))) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * Convert a single file
 */
function convertFile(filePath) {
  try {
    console.log(`Converting: ${filePath}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const converted = convertTsToJs(content);
    
    // Determine new file path
    let newPath;
    if (filePath.endsWith('.tsx')) {
      newPath = filePath.replace('.tsx', '.jsx');
    } else if (filePath.endsWith('.ts')) {
      newPath = filePath.replace('.ts', '.js');
    }
    
    // Write converted file
    fs.writeFileSync(newPath, converted);
    
    // Delete original file
    fs.unlinkSync(filePath);
    
    console.log(`✅ Converted: ${filePath} → ${newPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error converting ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Main conversion function
 */
function main() {
  console.log('🚀 Starting TypeScript to JavaScript conversion...\n');
  
  const tsFiles = getTsFiles(SRC_DIR);
  console.log(`Found ${tsFiles.length} TypeScript files to convert\n`);
  
  let converted = 0;
  let failed = 0;
  
  for (const file of tsFiles) {
    if (convertFile(file)) {
      converted++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n🎉 Conversion complete!`);
  console.log(`✅ Successfully converted: ${converted} files`);
  console.log(`❌ Failed to convert: ${failed} files`);
  
  if (failed === 0) {
    console.log('\n🔧 Next steps:');
    console.log('1. Update package.json to remove TypeScript dependencies');
    console.log('2. Update import paths in files that reference converted files');
    console.log('3. Test the application to ensure everything works');
    console.log('4. Remove tsconfig.json and other TypeScript config files');
  }
}

// Run the conversion
if (require.main === module) {
  main();
}

module.exports = { convertTsToJs, getTsFiles, convertFile };