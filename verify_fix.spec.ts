import { test, expect } from '@playwright/test';
import path from 'path';

test('verify dialog width and table columns', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Click on Rendimentos card
  await page.getByText('Declaração de Rendimentos').click();

  // Upload JSON
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Carregar JSON').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path.join(process.cwd(), 'client/src/lib/__tests__/rendimentos_mock.json'));

  // Wait for table
  await page.waitForSelector('table');

  // Take screenshot of main table to check columns
  await page.screenshot({ path: 'main_table_fix.png' });

  // Click view all entries for first worker
  await page.locator('button').filter({ has: page.locator('svg.lucide-layout-list') }).first().click();

  // Wait for dialog
  await page.waitForSelector('div[role="dialog"]');

  // Take screenshot of dialog
  await page.screenshot({ path: 'dialog_fix.png' });
});
