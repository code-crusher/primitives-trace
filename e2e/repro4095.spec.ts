import { expect, test } from '@playwright/test';
import { visitStory } from './helpers';

// Repro for https://github.com/radix-ui/primitives/issues/4095 — items inside
// a submenu must be clickable.
test.describe('ContextMenu submenu clicks', () => {
  test.beforeEach(async ({ page }) => {
    await visitStory(page, 'contextmenu--submenus');
    await page.getByText('Right Click Here', { exact: true }).click({ button: 'right' });
  });

  test('fires onSelect for an item in an open submenu', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (message) => consoleMessages.push(message.text()));

    await page.getByText('Bookmarks →', { exact: true }).hover();
    await expect(page.getByText('Inbox', { exact: true })).toBeVisible();

    await page.getByText('Inbox', { exact: true }).click();
    await expect.poll(() => consoleMessages).toContain('index');
    await expect(page.getByText('Inbox', { exact: true })).toHaveCount(0);
  });

  test('fires onSelect for an item in a nested submenu opened via pointer', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (message) => consoleMessages.push(message.text()));

    await page.getByText('Bookmarks →', { exact: true }).hover();
    await page.getByText('WorkOS →', { exact: true }).hover();
    await expect(page.getByText('Stitches', { exact: true })).toBeVisible();

    await page.getByText('Stitches', { exact: true }).click();
    await expect.poll(() => consoleMessages).toContain('stitches');
  });

  test('fires onSelect for an item in a submenu opened via keyboard', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (message) => consoleMessages.push(message.text()));

    await page.getByText('Bookmarks →', { exact: true }).press('ArrowRight');
    await expect(page.getByText('Inbox', { exact: true })).toBeVisible();

    await page.keyboard.press('Enter');
    await expect.poll(() => consoleMessages).toContain('index');
  });
});
