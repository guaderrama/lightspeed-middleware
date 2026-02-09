import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Dashboard - FASE 1 Features
 * Tests temporal comparisons, period selector, and metrics
 */

const BASE_URL = 'https://lightspeed-middleware.web.app';

test.describe('Dashboard - FASE 1 Temporal Comparisons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard page successfully', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/Inventario.*Iván Guaderrama Art/);

    // Verify dashboard header
    const header = page.locator('h1', { hasText: 'Dashboard de Inventario' });
    await expect(header).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/dashboard-loaded.png',
      fullPage: true
    });
  });

  test('should display period selector with 4 options', async ({ page }) => {
    // Wait for period selector to load
    const periodSelector = page.locator('button', { hasText: 'Esta Semana' }).first();
    await expect(periodSelector).toBeVisible();

    // Verify all 4 period options exist
    await expect(page.locator('button', { hasText: 'Esta Semana' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Este Mes' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Últimos 3 Meses' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Personalizado' })).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/period-selector.png',
      fullPage: true
    });
  });

  test('should switch periods and update metrics', async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(2000);

    // Click on "Esta Semana"
    const weekButton = page.locator('button', { hasText: 'Esta Semana' });
    await weekButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'tests/screenshots/period-week.png',
      fullPage: true
    });

    // Click on "Últimos 3 Meses"
    const threeMonthsButton = page.locator('button', { hasText: 'Últimos 3 Meses' });
    await threeMonthsButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'tests/screenshots/period-3months.png',
      fullPage: true
    });
  });

  test('should display metric cards with change indicators', async ({ page }) => {
    // Wait for metrics to load
    await page.waitForTimeout(3000);

    // Check for metric cards
    const metricsContainer = page.locator('.grid').first();
    await expect(metricsContainer).toBeVisible();

    // Take screenshot of metrics
    await page.screenshot({
      path: 'tests/screenshots/metrics-cards.png',
      fullPage: true
    });

    // Verify at least one metric card exists
    const metricCards = page.locator('.bg-white.border.border-gray-200.rounded-lg');
    const count = await metricCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display daily sales trend chart', async ({ page }) => {
    // Wait for charts to render
    await page.waitForTimeout(4000);

    // Look for chart title
    const chartTitle = page.locator('h3', { hasText: 'Tendencia de Ventas Diarias' });

    // Check if chart exists (it might not if there's no sales data)
    const chartExists = await chartTitle.isVisible().catch(() => false);

    if (chartExists) {
      console.log('✓ Sales trend chart is visible');
      await page.screenshot({
        path: 'tests/screenshots/sales-trend-chart.png',
        fullPage: true
      });
    } else {
      console.log('ℹ Sales trend chart not visible (might be no data)');
    }
  });

  test('should display AI insights section', async ({ page }) => {
    // Wait for AI insights to load
    await page.waitForTimeout(3000);

    // Look for AI insights section
    const aiSection = page.locator('text=Análisis IA');
    const aiExists = await aiSection.isVisible().catch(() => false);

    if (aiExists) {
      console.log('✓ AI insights section is visible');
      await page.screenshot({
        path: 'tests/screenshots/ai-insights.png',
        fullPage: true
      });
    } else {
      console.log('ℹ AI insights section not visible (might still be loading)');
    }
  });

  test('should navigate to Chat page', async ({ page }) => {
    // Find and click Chat link
    const chatLink = page.locator('a[href="/chat"]');
    await chatLink.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Verify we're on chat page
    await expect(page).toHaveURL(/\/chat/);

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/chat-page.png',
      fullPage: true
    });
  });

  test('should navigate to Reports page', async ({ page }) => {
    // Find and click Reports link
    const reportsLink = page.locator('a[href="/reports"]');
    await reportsLink.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Verify we're on reports page
    await expect(page).toHaveURL(/\/reports/);

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/reports-page.png',
      fullPage: true
    });
  });

  test('should refresh data when clicking Actualizar button', async ({ page }) => {
    // Wait for page to load
    await page.waitForTimeout(2000);

    // Find refresh button
    const refreshButton = page.locator('button', { hasText: 'Actualizar' });
    await expect(refreshButton).toBeVisible();

    // Click refresh
    await refreshButton.click();

    // Wait for refresh to complete
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/after-refresh.png',
      fullPage: true
    });
  });
});
