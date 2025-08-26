import { test, expect } from '@playwright/test';

test.describe('Basic Application Tests', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if the page has loaded successfully
    await expect(page).toHaveTitle(/Eyes on Screen Quiz/i);
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check for basic accessibility
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});