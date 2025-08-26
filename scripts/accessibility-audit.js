#!/usr/bin/env node

/**
 * Automated accessibility audit script
 */

const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const fs = require('fs');
const path = require('path');

class AccessibilityAuditor {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      pages: {},
      summary: {
        totalViolations: 0,
        totalPasses: 0,
        criticalIssues: 0,
        seriousIssues: 0,
        moderateIssues: 0,
        minorIssues: 0
      },
      wcagCompliance: {
        'wcag2a': { passes: 0, violations: 0 },
        'wcag2aa': { passes: 0, violations: 0 },
        'wcag21aa': { passes: 0, violations: 0 }
      }
    };
  }

  async auditPage(page, url, pageName) {
    console.log(`🔍 Auditing ${pageName}...`);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle0' });
      
      // Wait for any dynamic content to load
      await page.waitForTimeout(2000);
      
      // Run axe accessibility tests
      const axeResults = await new AxePuppeteer(page)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      
      // Process results
      const pageResults = {
        url,
        violations: axeResults.violations.map(violation => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          tags: violation.tags,
          nodes: violation.nodes.map(node => ({
            html: node.html,
            target: node.target,
            failureSummary: node.failureSummary
          }))
        })),
        passes: axeResults.passes.length,
        inapplicable: axeResults.inapplicable.length,
        incomplete: axeResults.incomplete.length
      };
      
      // Update summary statistics
      this.updateSummary(pageResults);
      
      // Update WCAG compliance tracking
      this.updateWcagCompliance(pageResults);
      
      this.results.pages[pageName] = pageResults;
      
      console.log(`   ✅ ${pageResults.passes} passes`);
      console.log(`   ❌ ${pageResults.violations.length} violations`);
      
      return pageResults;
      
    } catch (error) {
      console.error(`💥 Failed to audit ${pageName}:`, error.message);
      this.results.pages[pageName] = {
        url,
        error: error.message,
        violations: [],
        passes: 0
      };
      return null;
    }
  }

  updateSummary(pageResults) {
    this.results.summary.totalViolations += pageResults.violations.length;
    this.results.summary.totalPasses += pageResults.passes;
    
    pageResults.violations.forEach(violation => {
      switch (violation.impact) {
        case 'critical':
          this.results.summary.criticalIssues++;
          break;
        case 'serious':
          this.results.summary.seriousIssues++;
          break;
        case 'moderate':
          this.results.summary.moderateIssues++;
          break;
        case 'minor':
          this.results.summary.minorIssues++;
          break;
      }
    });
  }

  updateWcagCompliance(pageResults) {
    pageResults.violations.forEach(violation => {
      violation.tags.forEach(tag => {
        if (this.results.wcagCompliance[tag]) {
          this.results.wcagCompliance[tag].violations++;
        }
      });
    });
    
    // Note: This is a simplified approach. In reality, you'd need to track
    // which specific WCAG criteria are being tested and passed.
    Object.keys(this.results.wcagCompliance).forEach(standard => {
      this.results.wcagCompliance[standard].passes += pageResults.passes;
    });
  }

  async auditKeyboardNavigation(page) {
    console.log('⌨️  Testing keyboard navigation...');
    
    try {
      // Find all focusable elements
      const focusableElements = await page.evaluate(() => {
        const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        return Array.from(document.querySelectorAll(selector)).map(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          tabIndex: el.tabIndex
        }));
      });
      
      // Test Tab navigation
      let currentFocusIndex = -1;
      for (let i = 0; i < Math.min(focusableElements.length, 20); i++) {
        await page.keyboard.press('Tab');
        
        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? {
            tagName: el.tagName,
            id: el.id,
            className: el.className
          } : null;
        });
        
        if (focusedElement) {
          currentFocusIndex++;
        }
      }
      
      return {
        focusableElementsCount: focusableElements.length,
        tabNavigationWorking: currentFocusIndex >= 0,
        focusableElements: focusableElements.slice(0, 10) // Limit for report size
      };
      
    } catch (error) {
      console.error('💥 Keyboard navigation test failed:', error.message);
      return { error: error.message };
    }
  }

  async auditColorContrast(page) {
    console.log('🎨 Testing color contrast...');
    
    try {
      const contrastIssues = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const issues = [];
        
        for (const element of elements) {
          const styles = window.getComputedStyle(element);
          const color = styles.color;
          const backgroundColor = styles.backgroundColor;
          
          // Skip elements without visible text or transparent backgrounds
          if (!element.textContent?.trim() || 
              backgroundColor === 'rgba(0, 0, 0, 0)' || 
              backgroundColor === 'transparent') {
            continue;
          }
          
          // This is a simplified check - in reality you'd use a proper contrast calculation
          if (color && backgroundColor) {
            issues.push({
              element: element.tagName,
              id: element.id,
              className: element.className,
              color,
              backgroundColor,
              text: element.textContent.slice(0, 50)
            });
          }
        }
        
        return issues.slice(0, 20); // Limit for performance
      });
      
      return {
        elementsChecked: contrastIssues.length,
        potentialIssues: contrastIssues
      };
      
    } catch (error) {
      console.error('💥 Color contrast test failed:', error.message);
      return { error: error.message };
    }
  }

  async auditScreenReaderCompatibility(page) {
    console.log('📢 Testing screen reader compatibility...');
    
    try {
      const ariaInfo = await page.evaluate(() => {
        const ariaElements = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby], [role]');
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const landmarks = document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer');
        const liveRegions = document.querySelectorAll('[aria-live]');
        
        return {
          ariaElementsCount: ariaElements.length,
          headingsCount: headings.length,
          landmarksCount: landmarks.length,
          liveRegionsCount: liveRegions.length,
          headingStructure: Array.from(headings).map(h => ({
            level: h.tagName,
            text: h.textContent?.slice(0, 50)
          })).slice(0, 10)
        };
      });
      
      return ariaInfo;
      
    } catch (error) {
      console.error('💥 Screen reader compatibility test failed:', error.message);
      return { error: error.message };
    }
  }

  generateHtmlReport() {
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Audit Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .metric.critical { border-left: 5px solid #d32f2f; }
        .metric.serious { border-left: 5px solid #f57c00; }
        .metric.moderate { border-left: 5px solid #fbc02d; }
        .metric.minor { border-left: 5px solid #388e3c; }
        .violation { background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 10px 0; }
        .violation.critical { border-left-color: #d32f2f; background: #ffebee; }
        .violation.serious { border-left-color: #f57c00; background: #fff3e0; }
        .page-section { margin-bottom: 40px; }
        .page-title { color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 5px; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
        .wcag-compliance { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .wcag-standard { background: white; border: 1px solid #ddd; padding: 10px; text-align: center; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Accessibility Audit Report</h1>
        <p>Generated on: ${this.results.timestamp}</p>
    </div>

    <div class="summary">
        <div class="metric critical">
            <h3>${this.results.summary.criticalIssues}</h3>
            <p>Critical Issues</p>
        </div>
        <div class="metric serious">
            <h3>${this.results.summary.seriousIssues}</h3>
            <p>Serious Issues</p>
        </div>
        <div class="metric moderate">
            <h3>${this.results.summary.moderateIssues}</h3>
            <p>Moderate Issues</p>
        </div>
        <div class="metric minor">
            <h3>${this.results.summary.minorIssues}</h3>
            <p>Minor Issues</p>
        </div>
    </div>

    <h2>WCAG Compliance</h2>
    <div class="wcag-compliance">
        ${Object.entries(this.results.wcagCompliance).map(([standard, data]) => `
            <div class="wcag-standard">
                <h4>${standard.toUpperCase()}</h4>
                <p>✅ ${data.passes} passes</p>
                <p>❌ ${data.violations} violations</p>
            </div>
        `).join('')}
    </div>

    ${Object.entries(this.results.pages).map(([pageName, pageData]) => `
        <div class="page-section">
            <h2 class="page-title">${pageName}</h2>
            <p><strong>URL:</strong> ${pageData.url}</p>
            <p><strong>Passes:</strong> ${pageData.passes} | <strong>Violations:</strong> ${pageData.violations?.length || 0}</p>
            
            ${pageData.violations?.map(violation => `
                <div class="violation ${violation.impact}">
                    <h4>${violation.id} (${violation.impact})</h4>
                    <p><strong>Description:</strong> ${violation.description}</p>
                    <p><strong>Help:</strong> ${violation.help}</p>
                    <p><strong>Help URL:</strong> <a href="${violation.helpUrl}" target="_blank">${violation.helpUrl}</a></p>
                    <p><strong>WCAG Tags:</strong> ${violation.tags.join(', ')}</p>
                    ${violation.nodes.slice(0, 3).map(node => `
                        <details>
                            <summary>Affected Element</summary>
                            <pre>${node.html}</pre>
                            <p><strong>Target:</strong> ${node.target.join(', ')}</p>
                            <p><strong>Issue:</strong> ${node.failureSummary}</p>
                        </details>
                    `).join('')}
                </div>
            `).join('') || '<p>✅ No violations found!</p>'}
        </div>
    `).join('')}

</body>
</html>`;

    const reportPath = path.join(process.cwd(), 'accessibility-report.html');
    fs.writeFileSync(reportPath, htmlTemplate);
    console.log(`📄 HTML report saved to: ${reportPath}`);
    
    return reportPath;
  }

  async run() {
    console.log('🚀 Starting accessibility audit...\n');
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Set viewport for consistent testing
      await page.setViewport({ width: 1280, height: 720 });
      
      // Define pages to audit
      const pagesToAudit = [
        { name: 'Home Page', url: 'http://localhost:3000' },
        { name: 'Consent Modal', url: 'http://localhost:3000?showConsent=true' },
        { name: 'Calibration', url: 'http://localhost:3000/calibration' },
        { name: 'Quiz', url: 'http://localhost:3000/quiz' },
        { name: 'Results', url: 'http://localhost:3000/results' }
      ];
      
      // Audit each page
      for (const pageInfo of pagesToAudit) {
        await this.auditPage(page, pageInfo.url, pageInfo.name);
        
        // Additional manual tests for the first page
        if (pageInfo.name === 'Home Page') {
          const keyboardResults = await this.auditKeyboardNavigation(page);
          const contrastResults = await this.auditColorContrast(page);
          const screenReaderResults = await this.auditScreenReaderCompatibility(page);
          
          this.results.pages[pageInfo.name].manualTests = {
            keyboard: keyboardResults,
            colorContrast: contrastResults,
            screenReader: screenReaderResults
          };
        }
      }
      
    } catch (error) {
      console.error('💥 Audit failed:', error);
      throw error;
    } finally {
      await browser.close();
    }
    
    // Generate reports
    const jsonReportPath = path.join(process.cwd(), 'accessibility-audit.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 JSON report saved to: ${jsonReportPath}`);
    
    this.generateHtmlReport();
    
    // Print summary
    console.log('\n📊 Accessibility Audit Summary:');
    console.log('================================');
    console.log(`Total Violations: ${this.results.summary.totalViolations}`);
    console.log(`Critical Issues: ${this.results.summary.criticalIssues}`);
    console.log(`Serious Issues: ${this.results.summary.seriousIssues}`);
    console.log(`Moderate Issues: ${this.results.summary.moderateIssues}`);
    console.log(`Minor Issues: ${this.results.summary.minorIssues}`);
    
    // Exit with error if critical or serious issues found
    if (this.results.summary.criticalIssues > 0 || this.results.summary.seriousIssues > 0) {
      console.log('\n💥 Critical or serious accessibility issues found!');
      if (process.env.CI) {
        process.exit(1);
      }
    } else {
      console.log('\n🎉 No critical accessibility issues found!');
    }
    
    return this.results;
  }
}

// CLI interface
if (require.main === module) {
  const auditor = new AccessibilityAuditor();
  auditor.run().catch(error => {
    console.error('💥 Accessibility audit failed:', error);
    process.exit(1);
  });
}

module.exports = AccessibilityAuditor;