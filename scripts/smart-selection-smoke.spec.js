const { test, expect } = require('@playwright/test');

test('admin page loads smart tools without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://127.0.0.1:4173/admin.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  await expect(page.getByText('التقاط العناصر', { exact: true }).first()).toBeVisible({ timeout: 30000 });

  const state = await page.evaluate(() => ({
    hasSmart: typeof PBSmart !== 'undefined',
    hasVision: typeof AIVision !== 'undefined',
    refineText: document.body.innerText.includes('＋ إضافة') && document.body.innerText.includes('− استبعاد')
  }));

  expect(state.hasSmart).toBeTruthy();
  expect(state.hasVision).toBeTruthy();
  expect(state.refineText).toBeTruthy();
  expect(errors, errors.join(' | ')).toEqual([]);
});
