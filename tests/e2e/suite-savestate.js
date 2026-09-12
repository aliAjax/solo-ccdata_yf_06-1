import { patchSetItem, storedPairs, unpatchSetItem, waitText, waitToast } from './helpers.js';

export const name = '保存失败与重试';

/**
 * 覆盖：存储满（QuotaExceededError）、权限拒绝（SecurityError）、短时失败自动恢复。
 * 每个阶段同时断言 localStorage 实际内容、toast/徽标/常驻提示、重试结果三者一致，
 * 且失败绝不会显示成成功。
 */
export async function run({ browser, baseURL, check }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => check(`页面异常 ${e.message}`, false));

  const footerSaved = () => page.locator('.studio-foot').textContent().then(t => t.includes('已自动保存'));
  const footerUnsaved = () => page.locator('.studio-foot').textContent().then(t => t.includes('未保存'));
  const pillVisible = () => page.locator('.save-alert').isVisible();

  await page.goto(baseURL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.pair');
  check('初始为已保存状态', (await footerSaved()) && !(await pillVisible()));

  // ---------- S1 存储满：新建 + 字体调整 ----------
  await patchSetItem(page, 'quota');
  await page.click('.actions >> text=新建方案');
  await page.fill('.modal input >> nth=0', 'Quota test');
  await page.click('text=创建方案');
  check('新建触发失败提示', await waitToast(page, '未能写入'));
  check('底部徽标显示未保存', await footerUnsaved());
  check('不把失败写成成功', !(await footerSaved()));
  check('常驻未保存提示出现', await pillVisible());
  let stored = await storedPairs(page);
  check('失败未写入存储', stored.length === 3 && !stored.some(p => p.title === 'Quota test'));

  await page.fill('input[aria-label="标题字号"]', '60');
  await page.waitForTimeout(300);
  check('字体调整后仍未保存', (await pillVisible()) && (await footerUnsaved()));
  check('字体调整未写入存储', (await storedPairs(page)).length === 3);

  await page.click('.save-alert-retry');
  check('重试仍失败有提示', await waitToast(page, '仍然无法写入'));
  check('重试失败保持未保存态', (await pillVisible()) && (await footerUnsaved()) && !(await footerSaved()));

  await unpatchSetItem(page);
  await page.click('.save-alert-retry');
  check('重试中状态可区分', await waitText(page, '.save-alert', '正在重试', 1500));
  check('重试成功提示', await waitToast(page, '已重新保存'));
  check('恢复已保存徽标', await waitText(page, '.studio-foot .save', '已自动保存'));
  check('常驻提示消失', !(await pillVisible()));
  stored = await storedPairs(page);
  check('重试后数据一致（含字体调整）', stored.length === 4 && stored.some(p => p.title === 'Quota test' && p.size === 60));

  // ---------- S2 权限拒绝：删除 + 重命名 + 自动恢复 ----------
  await page.reload();
  await page.waitForSelector('.pair');
  check('重载后 4 条', (await page.locator('.pair').count()) === 4);
  await patchSetItem(page, 'security');
  await page.locator('.pair').first().locator('button[aria-label="移除方案"]').click();
  check('删除触发失败提示', await waitToast(page, '未能写入'));
  check('删除未写入存储', (await storedPairs(page)).length === 4);

  await page.locator('.pair').first().locator('button[aria-label="重命名 / 编辑"]').click();
  await page.fill('.modal input >> nth=0', '重命名后的方案');
  await page.click('text=保存修改');
  await page.waitForTimeout(300);
  check('重命名后仍未保存', (await pillVisible()) && !(await footerSaved()));
  check('重命名未写入存储', !(await storedPairs(page)).some(p => p.title === '重命名后的方案'));

  await unpatchSetItem(page);
  await page.locator('.pair').first().locator('button[aria-label="收藏"]').click();
  check('恢复后自动保存提示', await waitToast(page, '已恢复保存'));
  check('恢复后徽标已保存', await waitText(page, '.studio-foot .save', '已自动保存'));
  check('常驻提示消失', !(await pillVisible()));
  stored = await storedPairs(page);
  check('恢复后数据一致（删除+重命名+收藏）',
    stored.length === 3 && stored.some(p => p.title === '重命名后的方案' && p.favorite === true));

  // ---------- S3 短时失败自动恢复 ----------
  await patchSetItem(page, 2);
  await page.fill('input[aria-label="标题字号"]', '60');
  check('第 1 次写入失败进入未保存', await waitText(page, '.save-alert', '有改动未保存'));
  await page.fill('input[aria-label="标题字号"]', '62');
  await page.waitForTimeout(250);
  check('第 2 次写入仍失败', await pillVisible());
  await page.fill('input[aria-label="标题字号"]', '64');
  check('第 3 次写入成功自动恢复', await waitToast(page, '已恢复保存'));
  check('恢复后徽标已保存', await waitText(page, '.studio-foot .save', '已自动保存'));
  check('常驻提示消失', !(await pillVisible()));
  stored = await storedPairs(page);
  check('最终字号已持久化', stored.some(p => p.title === 'Editorial calm' && p.size === 64));

  await ctx.close();
}
