import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const APP_VIEWS = ['dashboard', 'tactics', 'schedule', 'squad', 'transfers', 'club', 'records'];
const SCREENSHOT_VIEWS = new Set(['dashboard', 'squad', 'transfers', 'club']);
const INTERNAL_SCROLL_CONTAINERS = '.table-wrap, .fixture-scroll, .existing-club-panel, .live-commentary';
const LAYOUT_TARGETS = [
  '.app-shell', '.topbar', '.sidebar', '.context-panel', '.content', '.page-header',
  '.card', '.metric-card', '.dashboard-quick-actions button', '.mobile-nav .nav__item',
  '.btn', 'input', 'select', '.live-match-center', '.game-dialog',
].join(',');

async function saveViewportScreenshot(page, testInfo, name) {
  const directory = path.resolve('responsive-screenshots', testInfo.project.name);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: false });
}

async function assertNoLayoutBreakage(page) {
  const result = await page.evaluate(({ targets, internalScrollContainers }) => {
    const root = document.documentElement;
    const viewportWidth = window.innerWidth;
    const offenders = [...document.querySelectorAll(targets)].flatMap((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const visible = style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) !== 0
        && rect.width > 0
        && rect.height > 0;
      if (!visible || element.closest(internalScrollContainers)) return [];
      if (rect.left >= -0.5 && rect.right <= viewportWidth + 0.5) return [];
      return [{
        selector: element.className || element.tagName,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        viewportWidth,
      }];
    });
    const pitchSlots = viewportWidth <= 680
      ? [...document.querySelectorAll('.pitch-slot')].map((element, index) => ({ index, rect: element.getBoundingClientRect() }))
      : [];
    const pitchCollisions = [];
    for (let index = 0; index < pitchSlots.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < pitchSlots.length; otherIndex += 1) {
        const first = pitchSlots[index];
        const second = pitchSlots[otherIndex];
        const overlapX = Math.min(first.rect.right, second.rect.right) - Math.max(first.rect.left, second.rect.left);
        const overlapY = Math.min(first.rect.bottom, second.rect.bottom) - Math.max(first.rect.top, second.rect.top);
        if (overlapX > 1 && overlapY > 1) pitchCollisions.push([first.index, second.index, overlapX, overlapY]);
      }
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      offenders: offenders.slice(0, 10),
      pitchCollisions: pitchCollisions.slice(0, 10),
    };
  }, { targets: LAYOUT_TARGETS, internalScrollContainers: INTERNAL_SCROLL_CONTAINERS });

  expect(result.scrollWidth, JSON.stringify(result)).toBeLessThanOrEqual(result.clientWidth);
  expect(result.offenders, JSON.stringify(result)).toEqual([]);
  expect(result.pitchCollisions, JSON.stringify(result)).toEqual([]);
}

async function assertMobileControls(page) {
  const viewport = page.viewportSize();
  if (!viewport || viewport.width > 680) return;

  const result = await page.evaluate(() => {
    const navItems = [...document.querySelectorAll('.mobile-nav .nav__item')]
      .filter((element) => getComputedStyle(element).display !== 'none')
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
      });
    const undersized = [...document.querySelectorAll([
      'button.btn',
      '.mobile-nav .nav__item',
      '.alert-item button',
      '.actions--management .btn',
      '.game-dialog__close',
    ].join(','))].flatMap((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return [];
      if (rect.width >= 43.5 && rect.height >= 43.5) return [];
      return [{ text: element.textContent?.trim().slice(0, 30), width: rect.width, height: rect.height }];
    });
    return { navItems, undersized };
  });

  const hasAppShell = await page.locator('.app-shell').count() > 0;
  if (hasAppShell) expect(result.navItems).toHaveLength(5);
  else expect(result.navItems).toHaveLength(0);
  for (const item of result.navItems) {
    expect(item.left).toBeGreaterThanOrEqual(-0.5);
    expect(item.right).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(item.height).toBeGreaterThanOrEqual(44);
  }
  expect(result.undersized, JSON.stringify(result.undersized)).toEqual([]);
}

async function auditCurrentScreen(page) {
  await assertNoLayoutBreakage(page);
  await assertMobileControls(page);
}

async function navigateTo(page, view) {
  const clicked = await page.evaluate((targetView) => {
    const element = [...document.querySelectorAll(`[data-nav="${targetView}"]`)]
      .find((candidate) => !candidate.closest('.mobile-nav'))
      ?? document.querySelector(`[data-nav="${targetView}"]`);
    if (!element) return false;
    element.click();
    return true;
  }, view);
  expect(clicked, `Navigation target ${view} was not found`).toBe(true);
  await page.waitForTimeout(80);
  await expect(page.locator('.content')).toBeVisible();
}

async function clickCommand(page, command) {
  const clicked = await page.evaluate((targetCommand) => {
    const element = document.querySelector(`[data-command="${targetCommand}"]`);
    if (!element) return false;
    element.click();
    return true;
  }, command);
  expect(clicked, `Command ${command} was not found`).toBe(true);
}

test('major game screens remain usable at the configured viewport', async ({ page }, testInfo) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#new-game-form')).toBeVisible();
  await auditCurrentScreen(page);
  await saveViewportScreenshot(page, testInfo, 'new-game');

  await page.locator('#new-game-form').evaluate((form) => form.requestSubmit());
  await expect(page.locator('.app-shell')).toBeVisible();

  for (const view of APP_VIEWS) {
    await navigateTo(page, view);
    await auditCurrentScreen(page);
    if (SCREENSHOT_VIEWS.has(view)) await saveViewportScreenshot(page, testInfo, view);
  }

  await navigateTo(page, 'dashboard');
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'desktop-large') {
    const quickActions = await page.locator('.dashboard-quick-actions').boundingBox();
    expect(quickActions).not.toBeNull();
    expect(quickActions.y + quickActions.height).toBeLessThanOrEqual(page.viewportSize().height);
  }

  await clickCommand(page, 'cloud-save');
  await expect(page.locator('.game-dialog')).toBeVisible();
  await auditCurrentScreen(page);
  await saveViewportScreenshot(page, testInfo, 'cloud-dialog');
  await page.locator('.game-dialog__close').click();

  await clickCommand(page, 'play-week');
  await expect(page.locator('.live-match-center')).toBeVisible();
  await auditCurrentScreen(page);
  await saveViewportScreenshot(page, testInfo, 'live-match');

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
});
