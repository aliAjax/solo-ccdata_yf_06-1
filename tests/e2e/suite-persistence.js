import { BACKUP_KEY, STORAGE_KEY, storedPairs, waitToast } from './helpers.js';

export const name = '持久化边界';

/**
 * 覆盖：首次启动示例、清空后刷新空库保持、再次打开数据原样、
 * 四类损坏数据（不可解析 / 字段类型错误 / pairs 非数组 / 部分非法）的备份与恢复。
 */
export async function run({ browser, baseURL, check }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => check(`页面异常 ${e.message}`, false));

  const pairCount = () => page.locator('.pair').count();
  const toastText = () => page.locator('.toast').textContent();
  const storedCount = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)).pairs.length, STORAGE_KEY);

  // ---------- T1 首次启动：示例出现 ----------
  await page.goto(baseURL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.pair');
  check('首次启动显示 3 条示例', (await pairCount()) === 3);

  // ---------- T2 清空全部方案后刷新：空库保持 ----------
  for (let i = 0; i < 3; i += 1) {
    await page.locator('.pair').first().locator('button[aria-label="移除方案"]').click();
    await page.waitForFunction(n => document.querySelectorAll('.pair').length === n, 2 - i, { timeout: 3000 });
  }
  check('清空后列表为 0', (await pairCount()) === 0);
  check('空库空态显示', await page.locator('.gallery .empty-state').isVisible());
  await page.reload();
  await page.waitForSelector('.gallery .empty-state');
  check('刷新后空库保持（示例不复活）', (await pairCount()) === 0);
  check('刷新后无示例卡片', (await page.locator('.pair-foot').allTextContents()).length === 0);
  check('本地存储为空库记录', (await storedCount()) === 0);

  // ---------- T3 再次打开：已有库原样保持 ----------
  await page.locator('.gallery .empty-state button', { hasText: '新建方案' }).click();
  await page.fill('.modal input >> nth=0', 'Only one');
  await page.click('text=创建方案');
  await page.waitForSelector('.pair');
  await page.reload();
  await page.waitForSelector('.pair');
  check('再次打开恰好 1 条（不掺入示例）', (await pairCount()) === 1);
  check('内容保持', (await page.locator('.pair-foot > span:first-child').textContent()).trim() === 'Only one');
  await page.reload();
  await page.waitForSelector('.pair');
  check('第三次打开仍为 1 条', (await pairCount()) === 1);

  // ---------- T4a 损坏：JSON 无法解析 ----------
  await page.evaluate(k => localStorage.setItem(k, '{broken!!'), STORAGE_KEY);
  await page.reload();
  check('不可解析 → 恢复提示', await waitToast(page, '损坏'));
  check('不可解析 → 回到空库而非示例', (await pairCount()) === 0 && (await page.locator('.gallery .empty-state').isVisible()));
  check('不可解析 → 原数据已备份', (await page.evaluate(k => localStorage.getItem(k), BACKUP_KEY)) === '{broken!!');

  // ---------- T4b 损坏：外层可读、字段类型错误 ----------
  const wrongTypes = JSON.stringify({ version: 1, pairs: [{ id: 'x1', title: 123, heading: false, body: 7, size: 'huge' }] });
  await page.evaluate(([k, b, v]) => { localStorage.removeItem(b); localStorage.setItem(k, v); }, [STORAGE_KEY, BACKUP_KEY, wrongTypes]);
  await page.reload();
  check('字段类型错误 → 恢复提示', await waitToast(page, '损坏'));
  check('字段类型错误 → 空库而非示例', (await pairCount()) === 0);
  check('字段类型错误 → 原数据已备份', await page.evaluate(k => {
    const raw = localStorage.getItem(k);
    return raw !== null && JSON.parse(raw).pairs[0].title === 123;
  }, BACKUP_KEY));

  // ---------- T4c 损坏：pairs 不是数组 ----------
  await page.evaluate(([k, b, v]) => { localStorage.removeItem(b); localStorage.setItem(k, v); }, [STORAGE_KEY, BACKUP_KEY, '{"pairs":"oops"}']);
  await page.reload();
  check('pairs 非数组 → 恢复提示', await waitToast(page, '损坏'));
  check('pairs 非数组 → 原数据已备份', (await page.evaluate(k => localStorage.getItem(k), BACKUP_KEY)) === '{"pairs":"oops"}');

  // ---------- T4d 恢复后再次打开：不重复报警、空库保持 ----------
  await page.reload();
  await page.waitForSelector('.gallery .empty-state');
  await page.waitForTimeout(1200);
  check('恢复后再次打开 → 不再报损坏', (await page.locator('.toast').count()) === 0);
  check('恢复后再次打开 → 空库保持（示例不复活）', (await pairCount()) === 0);

  // ---------- T4e 部分条目非法：保留合法 + 备份 + 提示 ----------
  const partial = JSON.stringify({ pairs: [
    { id: 'good-1', title: '幸存者', heading: 'Still here', body: 'Valid item', category: 'A', favorite: false, size: 40, weight: 500, leading: 1.4, tracking: 0 },
    { id: 'bad-1', title: '', heading: 'No title' },
    { id: 'good-1', title: '重复 id' },
  ] });
  await page.evaluate(([k, b, v]) => { localStorage.removeItem(b); localStorage.setItem(k, v); }, [STORAGE_KEY, BACKUP_KEY, partial]);
  await page.reload();
  await page.waitForSelector('.pair');
  check('部分非法 → 合法条目保留', (await pairCount()) === 1);
  check('部分非法 → 丢弃提示含备份说明', (await waitToast(page, '已被忽略')) && (await toastText()).includes('备份'));
  check('部分非法 → 原数据已备份', await page.evaluate(k => {
    const raw = localStorage.getItem(k);
    return raw !== null && JSON.parse(raw).pairs.length === 3;
  }, BACKUP_KEY));
  await page.reload();
  await page.waitForSelector('.pair');
  check('部分非法恢复后再次打开 → 仍是 1 条且无提示', (await pairCount()) === 1 && (await page.locator('.toast').count()) === 0);

  await ctx.close();
}
