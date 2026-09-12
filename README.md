# Type Pairer · 字体方案库

为排版设计师打造的本地字体配对方案库。方案支持分类管理、收藏筛选、关键词搜索与排序，
可新建、重命名、复制、移除、批量导入导出；导入时校验字段与重复项，冲突可逐项覆盖、
跳过或保留两份；移除、覆盖、批量导入均可撤销。字体、字号、行高、字距的调整实时同步
列表与预览，所有数据保存在浏览器 localStorage。

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 开发服务器（默认 5173 端口）
npm run build      # 类型检查 + 生产构建（输出 dist/）
npm run preview    # 预览构建产物（默认 4173 端口）
```

## 运行测试

端到端测试基于 Playwright，覆盖：首次启动、空库刷新、损坏数据恢复、存储失败重试、
窄屏通知层级，以及新建、编辑、复制、导入、撤销等核心业务流程。

```bash
# 首次运行前，安装 Chromium 浏览器二进制（只需一次）
npm run test:setup        # 等价于 npx playwright-core install chromium

# 构建并运行全部测试套件
npm test

# dist 已存在时跳过构建直接跑
npm run test:only

# 指向自己启动的服务（如开发服务器）
BASE_URL=http://localhost:5173 npm run test:only
```

Linux 环境若提示缺少系统库（libnss3、libatk 等），需要 sudo 安装系统依赖：

```bash
npx playwright-core install --with-deps chromium
```

测试产物（截图等）输出到 `tests/artifacts/`。测试结构：

```
tests/e2e/
├── run-all.js            # 入口：构建检查 → 启动 preview → 顺序执行 → 汇总
├── helpers.js            # 断言计数、toast/文本等待、存储故障注入
├── suite-main.js         # 核心业务回归（新建/编辑/复制/导入/撤销/搜索/排序/分类/移动端）
├── suite-persistence.js  # 首次启动 / 空库刷新 / 再次打开 / 损坏恢复
├── suite-savestate.js    # 存储满 / 权限拒绝 / 短时失败重试
└── suite-notify.js       # 通知层级（桌面 + 窄屏）
```

## 技术栈

React 19 + TypeScript + Vite。状态与持久化逻辑集中在 `src/hooks/useLibrary.ts`，
存储读写与损坏恢复在 `src/lib/storage.ts`，导入校验与合并在 `src/lib/library.ts`。
