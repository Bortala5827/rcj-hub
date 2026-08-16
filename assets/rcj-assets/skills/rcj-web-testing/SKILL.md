# rcj-web-testing — RCJ 标准 Web 自动化测试体系

给任意 RCJ 静态站点一键套用「**Playwright 冒烟/功能 + axe-core 无障碍 + Lighthouse CI + GitHub Actions 回归**」的标准测试体系。首个落地实例与黄金参考实现见 `Bortala5827/rcj-hub`（其 `TESTING.md` 与 `tests/`、`playwright.config.ts` 等同此 skill 的 templates）。

## 适用场景

- 纯静态站 / Cloudflare Pages 站（多页面、子路径挂载、子域子站混合）
- 需要在**本地用真实 Google Chrome** 测真实网站（不下载 Playwright Chromium）
- 需要在 GitHub Actions 做每次 push/PR 的回归（CI 用自带 chromium，不连本机 Chrome）
- 想测：页面/导航/功能/控制台/网络/无障碍/性能，并自动生成可下载报告

## 核心铁律（不可违背）

1. **本地禁止下载 Playwright Chromium** —— 必须 `channel: "chrome"` 调本机真实 Google Chrome；定位不到就报错，**不得擅装新浏览器**。
2. **CI 连不上本机 Chrome** —— CI 自动切到 Actions 自带的 chromium（用 `isCI` 环境变量切换 `channel`）。
3. **不改 CF 正式部署** —— CI 工作流只测试/验收，不部署生产。
4. **不为了通过而作弊** —— 不删测试、不跳过错误、不隐藏 console error、不忽略 404、不禁用功能、不删业务代码。第三方/运行时依赖问题**明确标记而非静默忽略**。
5. **真实问题回到产品代码修**，不在测试规则里 `exclude` 来求绿。

## 目录结构（套用后）

```
<项目>/
├── package.json            # 含 test / test:smoke / test:axe / lighthouse 等脚本 + devDeps
├── playwright.config.ts    # chrome channel 切换 + webServer + 失败保存
├── .lighthouserc.js        # Lighthouse CI（外部托管 + warn 阈值）
├── scripts/lhci-serve.mjs  # 自起 4200 静态服务、跑 LHCI、自动 kill（防僵尸进程）
├── tests/
│   ├── sites.ts            # 站点清单（单一事实来源）+ KNOWN_RUNTIME_PATHS 白名单
│   ├── smoke.spec.ts       # 页面/导航/功能/控制台/网络
│   └── axe.spec.ts         # 无障碍（@axe-core/playwright）
├── .github/workflows/test.yml  # push/PR 回归（测试/验收，不部署）
└── .gitignore             # 忽略 node_modules/ 报告目录，保留 package-lock.json
```

## 快速套用

```bash
# 1) 复制模板文件到目标项目根目录（注意末尾的 /. 含隐藏文件如 .gitignore / .lighthouserc.js）
cp -r ~/.workbuddy/skills/rcj-web-testing/templates/. ./   # 或手动逐文件复制

# 2) 安装依赖
npm install

# 3) 编辑 tests/sites.ts，填入你的站点清单（新增页面只改这里）

# 4) 本地跑（本机真实 Chrome）
npm test                 # 冒烟 + 功能
npm run test:axe         # 无障碍
npm run lighthouse       # 性能 / SEO / A11y / BP

# 5) 测线上（真实域名 + 子站）
npm run test:live        # BASE_URL=https://你的域名 TEST_LIVE_ECOSYSTEM=1

# 6) 提交 .github/workflows/test.yml 即自动接入 CI 回归
```

## 关键实现要点

### 浏览器切换（playwright.config.ts）
```ts
const isCI = !!process.env.CI;
const useChromeChannel = !isCI; // 本地用本机 Chrome，CI 用 chromium
projects: [{
  name: 'chrome',
  use: { ...devices['Desktop Chrome'], ...(useChromeChannel ? { channel: 'chrome' } : {}) },
}]
```

### 本地不托管、线上下打（webServer）
仅当 `BASE_URL` 含 `localhost`/`127.0.0.1` 时才由 Playwright 托管 `http-server`；测线上域名（`https://...`）时不托管，直接打线上。

### 运行时依赖白名单（tests/sites.ts）
CF Pages Functions 路由（如 `/api/track` 埋点）本地静态服务下必然失败，但线上 200。用 `KNOWN_RUNTIME_PATHS = ['/api/', '/cdn-cgi/']`，在 console/network 监听器里**按 location URL 排除，不静默**。

### 失败自动保存
`use: { screenshot:'only-on-failure', trace:'retain-on-failure', video:'retain-on-failure' }` + Reporter `html`（Playwright HTML Report）。

### axe 用 newContext
`@axe-core/playwright` 需要 `browser.newContext()`，不能用 `newPage()`；tags `wcag2a/wcag2aa/wcag21a/wcag21aa`；违规如实失败并附完整清单。

### Lighthouse 外部托管 + 自清理
`.lighthouserc.js` 不自起服务，只指向 `LH_BASE_URL`（默认 `http://localhost:4200`）。`scripts/lhci-serve.mjs` 自起 `http-server -p 4200`，等 3.5s，`lhci autorun`，结束 `server.kill()`，避免失败遗留僵尸进程占端口。第一阶段用 `warn` 阈值（详见 `.lighthouserc.js`），发现真实问题报警但不阻断。

### GitHub Actions（仅测试不部署）
steps：checkout → setup-node@v4(22, cache npm) → `npm ci` → `playwright install --with-deps chromium` → `browser-actions/setup-chrome@v1` → Playwright smoke → axe → Lighthouse（自起 4200 / 跑 / kill）→ upload-artifact（报告保留 14 天）。无部署步骤。

## 已知坑（已踩过，照做可避）

- **npm cleanup 抽空依赖**：沙箱下首次 `npm install` 可能把 `proxy-agent`/`pac-proxy-agent` 等 dist 抽空，导致 Lighthouse 报 `dist/index.js 缺失`。修复：`npm ci` 全量重装（保留 `package-lock.json`）。可在 `dependencies` 显式锁 `proxy-agent` 防抽空。
- **Lighthouse EADDRINUSE 僵尸进程**：失败遗留的 `http-server` 占 4200 → 改用外部托管 + `lhci-serve.mjs` 自清理。
- **`upload.target:'temporary'` 非法**：Lighthouse CI 不认此枚举，改 `target:'filesystem', outputDir:'./lighthouse-report'`。
- **axe `newPage()` 报错**：必须用 `browser.newContext().newPage()`。
- **`requestfailed` 事件**：用 `req.resourceType()` / `req.url()`，不要调 `req.request()`（不存在）。

## 模板文件清单

| 文件 | 作用 |
|---|---|
| `templates/package.json` | 脚本 + devDependencies（@axe-core/playwright / @lhci/cli / @playwright/test / cross-env / http-server / proxy-agent） |
| `templates/playwright.config.ts` | 浏览器策略、webServer、失败保存 |
| `templates/tests/sites.ts` | 站点清单 + 运行时路由白名单 |
| `templates/tests/smoke.spec.ts` | 页面/导航/功能/控制台/网络 |
| `templates/tests/axe.spec.ts` | 无障碍 |
| `templates/.lighthouserc.js` | Lighthouse CI（外部托管 + warn 阈值） |
| `templates/scripts/lhci-serve.mjs` | 自起 4200 服务 + 跑 + 清理 |
| `templates/.github/workflows/test.yml` | CI 回归（测试/验收，不部署） |

## 相关

- 黄金参考实现：`Bortala5827/rcj-hub`（`TESTING.md`）
- 更轻量的单脚本冒烟（无 axe/Lighthouse/CI）：`rcj-assets/skills/site-smoke-test`
