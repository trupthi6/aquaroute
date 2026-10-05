import { test, expect } from '@playwright/test';

test.describe('AquaRoute M2 and M3 E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173/');
  });

  test('M2-E01, M2-E02, M2-E03, M2-E04, M2-E05, M2-E06, M2-E07', async ({ page }) => {
    // Check for title
    await expect(page).toHaveTitle(/AquaRoute/);
    
    // Check for freshness banner
    await expect(page.locator('text=fresh')).toBeVisible({ timeout: 10000 });
    
    // Check for summary counts
    await expect(page.locator('text=LOW')).toBeVisible();

    // Check Now/Peak toggle
    await expect(page.locator('button[aria-pressed="true"]', { hasText: 'Peak' })).toBeVisible();
    await page.click('text=Now');
    await expect(page.locator('button[aria-pressed="true"]', { hasText: 'Now' })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: '../docs/screenshots/m2_dashboard.png' });
  });

  test('M3-E01, M3-E02 route panel interaction', async ({ page }) => {
    // Click 'Load demo trip'
    await page.click('button:has-text("Load demo trip")');
    
    // Compute route
    await page.click('button:has-text("Compute safe route")');

    // Wait for result
    await expect(page.locator('text=Route recommendation')).toBeVisible({ timeout: 15000 });
    
    // Take screenshot
    await page.screenshot({ path: '../docs/screenshots/m3_route_result.png' });
  });
});
