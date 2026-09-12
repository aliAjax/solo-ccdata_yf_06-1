import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STORAGE_KEY = 'type-pairer:library:v1';
export const BACKUP_KEY = 'type-pairer:library:corrupt-backup';

/** 截图等测试产物目录（run-all 会确保存在） */
export const ARTIFACTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../artifacts');

/** 每个套件一个计数器：check 记录通过/失败，stats 汇总 */
export function createChecker() {
  let failures = 0;
  let passes = 0;
  const check = (name, cond, extra = '') => {
    if (cond) {
      passes += 1;
      console.log(`  PASS  ${name}`);
    } else {
      failures += 1;
      console.log(`  FAIL  ${name} ${extra}`);
    }
  };
  return { check, stats: () => ({ failures, passes }) };
}

/** 等待出现包含指定文本的 toast */
export const waitToast = (page, frag, timeout = 4000) =>
  page
    .waitForFunction(f => document.querySelector('.toast')?.textContent.includes(f), frag, { timeout })
    .then(() => true)
    .catch(() => false);

/** 等待指定选择器的文本包含片段 */
export const waitText = (page, sel, frag, timeout = 4000) =>
  page
    .waitForFunction(([s, f]) => document.querySelector(s)?.textContent.includes(f), [sel, frag], { timeout })
    .then(() => true)
    .catch(() => false);

/** 读取 localStorage 中的方案数组 */
export const storedPairs = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)).pairs, STORAGE_KEY);

/**
 * 模拟存储写入失败：
 *   'quota'    —— 存储满（QuotaExceededError）
 *   'security' —— 权限拒绝（SecurityError）
 *   数字 n     —— 短时故障，接下来 n 次写入失败后自动恢复
 */
export async function patchSetItem(page, mode) {
  await page.evaluate(m => {
    window.__origSetItem = Storage.prototype.setItem;
    if (m === 'quota') {
      Storage.prototype.setItem = function () {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      };
    } else if (m === 'security') {
      Storage.prototype.setItem = function () {
        throw new DOMException('denied', 'SecurityError');
      };
    } else if (typeof m === 'number') {
      const orig = Storage.prototype.setItem;
      window.__failLeft = m;
      Storage.prototype.setItem = function (...args) {
        if (window.__failLeft-- > 0) throw new DOMException('quota', 'QuotaExceededError');
        return orig.apply(this, args);
      };
    }
  }, mode);
}

export async function unpatchSetItem(page) {
  await page.evaluate(() => {
    if (window.__origSetItem) Storage.prototype.setItem = window.__origSetItem;
  });
}
