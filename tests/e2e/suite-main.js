import fs from 'node:fs';
import path from 'node:path';
import { ARTIFACTS, storedPairs, waitToast } from './helpers.js';

export const name = '核心业务回归';

/**
 * 覆盖：初始加载、新建、字体调整列表/预览同步、重命名、复制、收藏筛选、
 * 搜索与无结果、排序、分类管理、导出、导入冲突逐项处理、
 * 撤销（移除/覆盖/批量导入/分类删除）、异常输入、持久化、空库与移动端。
 */
export async function run({ browser, baseURL, check }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => check(`页面异常 ${e.message}`, false));
  page.on('console', m => {
    if (m.type() === 'error') console.log('  console.error:', m.text());
  });

  // ---------- A. 初始加载与主流程 ----------
  await page.goto(baseURL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.pair');
  check('种子方案渲染 3 条', (await page.locator('.pair').count()) === 3);
  check('工作台显示选中方案', await page.locator('.studio h2').first().isVisible());

  // 新建
  await page.click('.actions >> text=新建方案');
  await page.fill('.modal input >> nth=0', 'Quiet confidence');
  await page.fill('.modal input >> nth=1', 'Editorial');
  await page.fill('.modal input >> nth=2', 'A quieter kind of bold');
  await page.fill('.modal textarea', 'Set in a calm text face with generous leading.');
  await page.click('text=创建方案');
  await page.waitForSelector('.toast');
  check('新建后列表为 4 条', (await page.locator('.pair').count()) === 4);
  check('新方案被选中进工作台', (await page.locator('.studio h2').first().textContent()) === 'Quiet confidence');

  // 字体调整同步列表与预览
  const cardStrong = page.locator('.pair.selected strong');
  const before = await cardStrong.evaluate(el => getComputedStyle(el).fontSize);
  await page.fill('input[aria-label="标题字号"]', '60');
  const previewSize = await page.locator('.preview h3').evaluate(el => getComputedStyle(el).fontSize);
  const cardSize = await cardStrong.evaluate(el => getComputedStyle(el).fontSize);
  check('字号调整同步预览', previewSize === '60px', `got ${previewSize}`);
  check('字号调整同步列表卡片', cardSize === '29px' && before !== cardSize, `got ${cardSize}`);

  await page.selectOption('label:has-text("标题字体") select', 'Space Grotesk');
  const previewFont = await page.locator('.preview h3').evaluate(el => getComputedStyle(el).fontFamily);
  const cardFont = await cardStrong.evaluate(el => getComputedStyle(el).fontFamily);
  check('字体调整同步预览', previewFont.includes('Space Grotesk'), previewFont);
  check('字体调整同步列表卡片', cardFont.includes('Space Grotesk'), cardFont);

  await page.fill('input[aria-label="正文行高"]', '1.6');
  const { lh, fsize } = await page.locator('.preview p').evaluate(el => {
    const cs = getComputedStyle(el);
    return { lh: parseFloat(cs.lineHeight), fsize: parseFloat(cs.fontSize) };
  });
  check('行高调整同步预览', Math.abs(lh / fsize - 1.6) < 0.01, `lh=${lh} fs=${fsize}`);

  await page.fill('input[aria-label="标题字距"]', '2');
  const tracking = await page.locator('.preview h3').evaluate(el => getComputedStyle(el).letterSpacing);
  check('字距调整同步预览', tracking === '2px', tracking);

  // 重命名
  await page.locator('.pair.selected .icon-btn[aria-label="重命名 / 编辑"]').click();
  await page.fill('.modal input >> nth=0', 'Quiet confidence v2');
  await page.click('text=保存修改');
  check('重命名生效', (await page.locator('.pair.selected .pair-foot span').first().textContent()) === 'Quiet confidence v2');

  // 复制
  await page.locator('.pair.selected .icon-btn[aria-label="复制方案"]').click();
  check('复制后列表为 5 条', (await page.locator('.pair').count()) === 5);
  check('副本命名', await page.locator('.pair').first().locator('.pair-foot span').first().textContent().then(t => t.includes('副本')));

  // 收藏与筛选（种子含 1 条已收藏，点击后应为 2）
  await page.locator('.pair').first().locator('button[aria-label="收藏"]').click();
  const favCountOk = await page
    .waitForFunction(() => document.querySelectorAll('aside .nav')[1]?.querySelector('b')?.textContent?.trim() === '2', null, { timeout: 3000 })
    .then(() => true).catch(() => false);
  check('侧边栏收藏计数为 2', favCountOk);
  await page.locator('aside .nav').nth(1).click();
  const favFilterOk = await page
    .waitForFunction(() => document.querySelectorAll('.pair').length === 2, null, { timeout: 3000 })
    .then(() => true).catch(() => false);
  check('收藏筛选只显示 2 条', favFilterOk);
  await page.locator('aside .nav').nth(0).click();
  check('返回全部恢复 5 条', (await page.locator('.pair').count()) === 5);

  // 搜索与无结果态
  await page.fill('.search-box input', 'quieter');
  check('关键词搜索命中', (await page.locator('.pair').count()) === 2);
  await page.fill('.search-box input', 'zzzz-no-match');
  check('无匹配结果显示空态', await page.locator('.empty-state').isVisible());
  check('空态文案正确', (await page.locator('.empty-state h3').textContent()) === '没有匹配的方案');
  await page.screenshot({ path: path.join(ARTIFACTS, 'no-results.png') });
  await page.click('text=清除筛选');
  check('清除筛选后恢复', (await page.locator('.pair').count()) === 5);

  // 排序
  const titlesOf = () => page.locator('.pair .pair-foot > span:first-child').allTextContents();
  await page.selectOption('.sort-box select', 'title');
  const titles = (await titlesOf()).map(t => t.trim());
  const sorted = [...titles].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  check('按名称 A–Z 排序', JSON.stringify(titles) === JSON.stringify(sorted), titles.join('|'));
  await page.selectOption('.sort-box select', 'size');
  const sizes = await page.locator('.pair strong').evaluateAll(els => els.map(e => parseFloat(getComputedStyle(e).fontSize)));
  check('按标题字号排序', sizes.every((v, i) => i === 0 || sizes[i - 1] >= v), sizes.join(','));

  // 分类筛选与管理
  await page.selectOption('.sort-box select', 'updated');
  await page.locator('aside .collection', { hasText: 'Editorial' }).first().click();
  const catCount = await page.locator('.pair').count();
  check('分类筛选生效', catCount === 3, `got ${catCount}`); // seed + v2 + 副本
  await page.locator('aside .collection', { hasText: 'Editorial' }).first().click();
  await page.click('aside .saved-head button');
  await page.locator('.category-list li', { hasText: 'Editorial' }).locator('button[aria-label^="重命名分类"]').click();
  await page.fill('.category-list input', '编辑精选');
  await page.locator('.category-list button[aria-label="确认重命名"]').click();
  check('分类重命名生效', (await page.locator('aside .collection', { hasText: '编辑精选' }).count()) === 1);
  page.once('dialog', d => d.accept());
  await page.locator('.category-list li', { hasText: 'Brand' }).locator('button[aria-label^="删除分类"]').click();
  check('删除分类后方案归入未分类', (await page.locator('.category-list li', { hasText: '未分类' }).count()) === 1);
  await page.click('.modal-actions >> text=完成');
  await page.click('.toast-action'); // 撤销删除分类
  const brandBack = await page
    .waitForFunction(() => [...document.querySelectorAll('aside .collection')].some(el => el.textContent.includes('Brand')), null, { timeout: 3000 })
    .then(() => true).catch(() => false);
  check('撤销删除分类', brandBack);

  // 导出
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('.actions >> text=导出')]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  check('导出 JSON 结构正确', exported.app === 'type-pairer' && Array.isArray(exported.pairs) && exported.pairs.length === 5);

  // ---------- B. 导入：冲突逐项处理 ----------
  const libNow = await storedPairs(page);
  const conflictId = libNow[0].id;
  const conflictOrigTitle = libNow[0].title;
  const importPayload = [
    { id: 'imp-new-1', title: 'Imported fresh', heading: 'Fresh import heading', body: 'Fresh body', category: 'Imported', favorite: false, size: 50, weight: 500, leading: 1.4, tracking: 1 },
    { id: conflictId, title: '覆盖后的标题', heading: 'Replaced heading', body: 'Replaced body', category: 'Imported' },
    { id: 'imp-new-1', title: '文件内重复' },
    { heading: 'No title at all' },
    { id: 'imp-bad-size', title: 'Bad size', size: 'huge' },
  ];
  await page.setInputFiles('[data-testid="import-input"]', { name: 'import.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(importPayload)) });
  await page.waitForSelector('.import-modal');
  check('导入对话框显示有效 2 条', await page.locator('.import-summary span').nth(0).textContent().then(t => t.includes('2')));
  check('导入对话框显示无效 3 条', await page.locator('.import-summary span').nth(1).textContent().then(t => t.includes('3')));
  check('导入对话框显示冲突 1 条', await page.locator('.import-summary span').nth(2).textContent().then(t => t.includes('1')));
  const errText = await page.locator('.import-errors').textContent();
  check('无效原因：缺 title', errText.includes('title'));
  check('无效原因：文件内重复', errText.includes('文件内重复'));
  check('无效原因：size 类型', errText.includes('size'));
  await page.screenshot({ path: path.join(ARTIFACTS, 'import-dialog.png') });
  await page.locator('.conflict-list .radio', { hasText: '覆盖' }).click();
  await page.click('text=确认导入');
  await page.waitForSelector('.toast');
  const toastText = await page.locator('.toast').textContent();
  check('导入 toast 统计正确', toastText.includes('新增 1') && toastText.includes('覆盖 1'), toastText);
  const libAfterImport = await storedPairs(page);
  check('覆盖生效：标题被替换', libAfterImport.find(p => p.id === conflictId)?.title === '覆盖后的标题');
  check('导入后总数 6', libAfterImport.length === 6, `got ${libAfterImport.length}`);

  // ---------- C. 撤销与恢复 ----------
  await page.click('.toast-action');
  const libAfterUndoImport = await storedPairs(page);
  check('撤销批量导入：总数回到 5', libAfterUndoImport.length === 5);
  check('撤销批量导入：覆盖被回滚', libAfterUndoImport.find(p => p.id === conflictId)?.title === conflictOrigTitle);

  await page.setInputFiles('[data-testid="import-input"]', { name: 'import2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ id: conflictId, title: '导入副本', heading: 'H', body: 'B' }])) });
  await page.waitForSelector('.import-modal');
  await page.locator('.conflict-list .radio', { hasText: '保留两份' }).click();
  await page.click('text=确认导入');
  await page.waitForSelector('.toast');
  let lib = await storedPairs(page);
  check('保留两份：总数 6 且原标题保留', lib.length === 6 && lib.some(p => p.title === '导入副本') && lib.some(p => p.id === conflictId && p.title === conflictOrigTitle));
  await page.click('.toast-action');

  await page.setInputFiles('[data-testid="import-input"]', { name: 'import3.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ id: conflictId, title: '不应出现', heading: 'H', body: 'B' }])) });
  await page.waitForSelector('.import-modal');
  await page.locator('.conflict-list .radio', { hasText: '跳过' }).click();
  await page.click('text=确认导入');
  await page.waitForSelector('.toast');
  lib = await storedPairs(page);
  check('跳过冲突：库不变', lib.length === 5 && !lib.some(p => p.title === '不应出现'));

  const countBeforeRemove = await page.locator('.pair').count();
  const removedTitle = (await page.locator('.pair .pair-foot span').first().textContent()).trim();
  await page.locator('.pair').first().locator('button[aria-label="移除方案"]').click();
  await page.waitForSelector('.toast');
  check('移除后少一条', (await page.locator('.pair').count()) === countBeforeRemove - 1);
  check('移除 toast 带撤销', (await page.locator('.toast').textContent()).includes('撤销'));
  await page.click('.toast-action');
  check('撤销移除后恢复', (await page.locator('.pair').count()) === countBeforeRemove);
  check('恢复的方案标题一致', (await page.locator('.pair .pair-foot span').allTextContents()).some(t => t.trim() === removedTitle));

  // ---------- D. 异常输入 ----------
  await page.setInputFiles('[data-testid="import-input"]', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{not valid json') });
  check('坏 JSON 导入报错', await waitToast(page, '导入失败'));
  await page.setInputFiles('[data-testid="import-input"]', { name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  check('结构不符导入报错', await waitToast(page, '未找到方案数组'));

  await page.click('.actions >> text=新建方案');
  await page.click('text=创建方案');
  check('空名称校验提示', await page.locator('.field-error').textContent().then(t => t.includes('不能为空')));
  check('校验失败弹窗不关闭', await page.locator('.modal').isVisible());
  await page.click('.modal-actions >> text=取消');

  // ---------- E. 持久化 / 损坏恢复 / 空库 / 移动端 ----------
  await page.reload();
  await page.waitForSelector('.pair');
  check('刷新后数据持久', (await page.locator('.pair').count()) === countBeforeRemove);

  await page.evaluate(() => localStorage.setItem('type-pairer:library:v1', '{broken!!'));
  await page.reload();
  await page.waitForSelector('.toast', { timeout: 5000 });
  check('损坏数据提示恢复', (await page.locator('.toast').textContent()).includes('损坏'));
  check('损坏后应用正常渲染', await page.locator('.app').isVisible());
  check('损坏备份已保留', (await page.evaluate(() => localStorage.getItem('type-pairer:library:corrupt-backup'))) === '{broken!!');

  check('空库显示空态', await page.locator('.gallery .empty-state').isVisible());
  check(
    '空态提供新建与导入',
    (await page.locator('.gallery .empty-state button', { hasText: '新建方案' }).isVisible()) &&
      (await page.locator('.gallery .empty-state button', { hasText: '导入方案' }).isVisible()),
  );
  check('空库时工作台占位', await page.locator('.studio-empty').isVisible());
  check('空库时导出禁用', await page.locator('.actions >> text=导出').isDisabled());
  await page.screenshot({ path: path.join(ARTIFACTS, 'empty.png') });
  await page.locator('.gallery .empty-state button', { hasText: '新建方案' }).click();
  await page.fill('.modal input >> nth=0', 'Back from empty');
  await page.click('text=创建方案');
  await page.waitForSelector('.pair');
  check('空库新建成功', (await page.locator('.pair').count()) === 1);

  const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await mob.newPage();
  await mp.goto(baseURL);
  await mp.waitForSelector('.pair');
  check('移动端侧边栏隐藏', !(await mp.locator('aside').isVisible()));
  check('移动端筛选条可见', await mp.locator('.mobile-filters').isVisible());
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('移动端无横向溢出', overflow <= 1, `overflow=${overflow}px`);
  await mp.selectOption('.mobile-filters select >> nth=0', 'favorites');
  check('移动端收藏筛选可用', (await mp.locator('.pair').count()) === 1); // 独立上下文，种子含 1 条收藏
  await mp.screenshot({ path: path.join(ARTIFACTS, 'mobile.png'), fullPage: true });
  await mob.close();

  await page.screenshot({ path: path.join(ARTIFACTS, 'main.png'), fullPage: true });
  await ctx.close();
}
