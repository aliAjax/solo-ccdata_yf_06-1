import path from 'node:path';
import { ARTIFACTS, patchSetItem, storedPairs, unpatchSetItem, waitToast } from './helpers.js';

export const name = '通知层级';

/**
 * 覆盖：保存失败 / 重试中 / 恢复成功三类通知在桌面与窄屏均不重叠、
 * 重试按钮可点击、toast 与常驻提示的消失时机正确、正常保存态无占位。
 */
async function runScenario(browser, baseURL, check, viewport, label) {
  console.log(`\n  [${label}] ${viewport.width}x${viewport.height}`);
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', e => check(`页面异常 ${e.message}`, false));

  await page.goto(baseURL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.pair');
  check('正常保存态无通知占位', (await page.locator('.notify-stack').count()) === 0);

  // 注入存储满失败
  await patchSetItem(page, 'quota');
  await page.click('.actions >> text=新建方案');
  await page.fill('.modal input >> nth=0', `Overlap ${label}`);
  await page.click('text=创建方案');
  check('失败 toast 出现', await waitToast(page, '未能写入'));
  check('常驻提示出现', await page.locator('.save-alert').isVisible());

  // 层级与不重叠
  const t = await page.locator('.toast').boundingBox();
  const a = await page.locator('.save-alert').boundingBox();
  const intersects = !!t && !!a && !(t.x + t.width <= a.x + 1 || a.x + a.width <= t.x + 1 || t.y + t.height <= a.y + 1 || a.y + a.height <= t.y + 1);
  check('toast 与常驻提示不重叠', !!t && !!a && !intersects, JSON.stringify({ t, a }));
  check('常驻提示在 toast 下方（层级有序）', !!t && !!a && a.y >= t.y + t.height - 1);
  check('两者都在视口内', !!t && !!a && t.x >= 0 && a.x >= 0 && t.x + t.width <= viewport.width + 1 && a.x + a.width <= viewport.width + 1);
  check('失败说明可见', await page.locator('.save-alert').textContent().then(s => s.includes('有改动未保存到本地')));
  check('重试按钮可见', await page.locator('.save-alert-retry').isVisible());

  // toast 仍在时点击常驻提示的重试（被遮罩则点击会超时失败）
  await page.locator('.save-alert-retry').click({ timeout: 3000 });
  check('toast 遮挡下重试仍可点击并触发', await waitToast(page, '仍然无法写入'));
  check('重试后仍是失败态', await page.locator('.save-alert').isVisible());
  await page.screenshot({ path: path.join(ARTIFACTS, `notify-${label}.png`) });

  // 消失时机：toast 自动消失，常驻提示保留
  await page.waitForTimeout(5800);
  check('失败 toast 到时自动消失', (await page.locator('.toast').count()) === 0);
  check('常驻提示仍然保留', await page.locator('.save-alert').isVisible());

  // 恢复存储 → 重试 → 成功
  await unpatchSetItem(page);
  await page.locator('.save-alert-retry').click();
  check('恢复重试成功提示', await waitToast(page, '已重新保存'));
  check('常驻提示随恢复消失', (await page.locator('.save-alert').count()) === 0);
  check('底部恢复已自动保存', await page.locator('.studio-foot').textContent().then(s => s.includes('已自动保存')));
  const stored = await storedPairs(page);
  check('改动已真实落盘', stored.some(p => p.title === `Overlap ${label}`));

  // 成功 toast 也到时消失，通知栈完全清空
  await page.waitForTimeout(5800);
  check('成功 toast 到时消失', (await page.locator('.toast').count()) === 0);
  check('通知栈完全清空', (await page.locator('.notify-stack').count()) === 0);

  await ctx.close();
}

export async function run({ browser, baseURL, check }) {
  await runScenario(browser, baseURL, check, { width: 1440, height: 900 }, 'desktop');
  await runScenario(browser, baseURL, check, { width: 390, height: 844 }, 'mobile');
}
