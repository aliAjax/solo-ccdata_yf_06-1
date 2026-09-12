/**
 * E2E 测试入口：构建检查 → 启动 vite preview → 顺序执行全部套件 → 汇总退出码。
 *
 * 用法：
 *   npm test                # 构建并运行全部套件
 *   npm run test:only       # 跳过构建直接运行（dist 已存在时）
 *   BASE_URL=http://localhost:5173 npm run test:only   # 指向已有服务
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { ARTIFACTS, createChecker } from './helpers.js';
import * as suiteMain from './suite-main.js';
import * as suitePersistence from './suite-persistence.js';
import * as suiteSavestate from './suite-savestate.js';
import * as suiteNotify from './suite-notify.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.PREVIEW_PORT || 4173);
// 显式绑定 127.0.0.1：vite preview 默认按 localhost 解析结果监听（可能是 ::1），
// 而 Node fetch 可能把 localhost 解析到另一个地址族，导致就绪探测 ECONNREFUSED
const HOST = '127.0.0.1';
const BASE_URL = process.env.BASE_URL || `http://${HOST}:${PORT}`;

fs.mkdirSync(ARTIFACTS, { recursive: true });

// ---------- 1. 确保构建产物存在 ----------
if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.log('dist 不存在，先执行构建…');
  const r = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('构建失败，测试终止');
    process.exit(1);
  }
}

// ---------- 2. 启动静态预览服务（外部提供 BASE_URL 时跳过） ----------
let server = null;
if (!process.env.BASE_URL) {
  const viteBin = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
  server = spawn(viteBin, ['preview', '--host', HOST, '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
  server.stderr.on('data', d => process.stderr.write(d));
  process.on('exit', () => server && server.kill('SIGKILL'));

  const deadline = Date.now() + 30000;
  let up = false;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) {
        up = true;
        break;
      }
    } catch {
      /* 服务尚未就绪，继续等待 */
    }
    await new Promise(r => setTimeout(r, 300));
  }
  if (!up) {
    console.error(`预览服务在 ${BASE_URL} 启动失败`);
    server.kill('SIGKILL');
    process.exit(1);
  }
  console.log(`预览服务已就绪：${BASE_URL}`);
}

// ---------- 3. 启动浏览器 ----------
let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  console.error('无法启动 Chromium。请先安装浏览器二进制：');
  console.error('  npx playwright-core install chromium');
  console.error('Linux 若缺系统依赖（需要 sudo）：');
  console.error('  npx playwright-core install --with-deps chromium');
  if (server) server.kill('SIGKILL');
  process.exit(1);
}

// ---------- 4. 顺序执行套件 ----------
const suites = [suiteMain, suitePersistence, suiteSavestate, suiteNotify];
let totalFailures = 0;
let totalPasses = 0;
for (const suite of suites) {
  console.log(`\n=== ${suite.name} ===`);
  const { check, stats } = createChecker();
  try {
    await suite.run({ browser, baseURL: BASE_URL, check });
  } catch (e) {
    console.error(`  套件异常: ${e.message}`);
    check('套件执行完成', false);
  }
  const s = stats();
  totalFailures += s.failures;
  totalPasses += s.passes;
  console.log(`  —— ${suite.name}: ${s.passes} 通过, ${s.failures} 失败`);
}

await browser.close();
if (server) server.kill('SIGTERM');

console.log(`\n总计: ${totalPasses} 通过, ${totalFailures} 失败`);
console.log(totalFailures === 0 ? '全部套件通过 ✅' : '存在失败项 ❌');
process.exit(totalFailures === 0 ? 0 : 1);
