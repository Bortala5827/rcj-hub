# site-smoke-test — 网站冒烟测试 Skill

用 Playwright（复用已装 chromium）对网站做自动化冒烟测试：遍历多页面/单页应用，抓控制台报错、检查渲染、截图、生成 Markdown 报告。适合每次改代码后本地跑一遍拦 bug。

## 适用场景

- **多城/多路径站点**（如辅警刷题站 `fj.rcj9527.dpdns.org` 的 sz/hz/gd/ms 等路径）
- **单页应用**（如 FaceTalk 面试搭子 `facetalk.955827.xyz`）
- **任何需要快速验证"线上没崩"的 Web 项目**

## 前置条件

| 依赖 | 来源 | 验证方式 |
|---|---|---|
| Node.js ≥ 22 | WorkBuddy 内置管理版 | `node --version` |
| @playwright/cli | npm 全局安装 | `playwright-cli --version` |
| Chromium 浏览器 | Playwright 安装时自动下载 | 检查 `~/.local/ms-playwright/chromium-*/chrome-win64/chrome.exe` |

> ⚠️ 不需要额外 `npm install playwright`，脚本通过 `createRequire` 复用 CLI 自带的 `playwright-core`。

## 快速使用

### 1. 复制脚本到项目目录

```bash
cp ~/.workbuddy/skills/site-smoke-test/scripts/smoke_test.mjs ./my_smoke_test.mjs
```

### 2. 编辑配置（脚本顶部）

```js
const BASE = 'https://your-site.com';        // 被测域名
const OUT = 'smoke_report';                   // 输出目录

// 多页面站：每个路径一个条目
const PAGES = [
  { path: '',     name: '总入口', expectKw: '首页关键词', hub: true,  minBody: 100, built: true },
  { path: 'sz',   name: '深圳',   expectKw: '深圳',       hub: false, minBody: 5000, built: true },
  { path: 'hz',   name: '惠州',   expectKw: '惠州',       hub: false, minBody: 5000, built: true },
  // { path: 'cd', name: '成都', expectKw: '成都', hub: false, minBody: 5000, built: false }, // 暂不测
];

// 单页应用：只配一条
// const PAGES = [{ path: '', name: 'FaceTalk 面试搭子', expectKw: '面试搭子', hub: true, minBody: 400, built: true }];
```

配置字段说明：

| 字段 | 必填 | 说明 |
|---|---|---|
| `path` | ✅ | URL 路径段（空字符串 = 根路径 `/`） |
| `name` | ✅ | 报告中的显示名称 |
| `expectKw` | ✅ | 渲染后的正文应包含的关键词（软校验） |
| `hub` | ✅ | 是否为总入口 Hub 页（Hub 正文偏短属正常） |
| `minBody` | ✅ | 视为「渲染正常」的最小正文长度（字符数） |
| `built` | ✅ | 是否已建好页面（`false` 则跳过） |

### 3. 运行

```bash
# Windows (Git Bash)
C:/Users/小样儿/.workbuddy/binaries/node/versions/22.22.2/node.exe my_smoke_test.mjs

# 或直接 node（如果 PATH 已配）
node my_smoke_test.mjs
```

### 4. 查看报告

打开 `smoke_report/report.md`，包含：
- 总评（🔴/🟡/✅）
- 每个路径的 HTTP 状态、控制台错误、正文长度、关键词命中
- 桌面 + 移动端截图（`smoke_report/shots/`）

## 报告判读

| 图标 | 含义 | 常见原因 |
|---|---|---|
| ✅ 正常 | 无报错、正文达标、关键词命中 | — |
| 🟡 缺关键词 | 正文未含 `expectKw` | SPA 未渲染完 / 关键词改了 / 路由不对 |
| 🟡 正文偏短 | bodyLen < minBody | SPA 数据未加载 / 白屏 / 骨架屏 |
| 🔴 控制台报错 | console.error 或 pageerror | JS 异常、资源 404、API 报错 |
| 🔴 访问失败 | goto 超时或网络错误 | DNS 解析失败、服务器宕机、SSL 问题 |

## 进阶用法

### 渐进式显示元素校验

某些 SPA 的表单/选项在点击按钮后才展开（如 FaceTalk 的岗位选择）。对于这类场景：

1. 在脚本中添加交互步骤（参考 `facetalk_smoke_test.mjs` 示例）
2. 用 `page.getByRole('button').click()` 触发展开
3. 展开后再用 `countVisibleText()` 校验隐藏元素

### 自定义交互测试

在 `testPage()` 返回前插入自定义操作：

```js
// 例：点击按钮并捕获后续错误
const beforeErr = errors.length;
await page.getByText('提交').click();
await page.waitForTimeout(1000);
console.log(`点击后新增 ${errors.length - beforeErr} 条错误`);
```

### CI 集成

可在 GitHub Actions 中运行（需安装 Chromium）：

```yaml
- name: Smoke test
  run: npx playwright install chromium && node smoke_test.mjs
```

## 已知限制

1. **Chromium 版本绑定**：脚本硬编码查找 `ms-playwright` 目录下的 chromium。如果升级了 @playwright/cli 导致 chromium 版本变化，需更新 `findChrome()` 中的候选路径。
2. **SPA 渲染等待**：默认等 2 秒 (`waitForTimeout(2000)`)。如果站点加载慢，可能需要增大。
3. **无真实用户行为模拟**：不登录、不填验证码、不处理弹窗。仅做"匿名访问是否正常"的冒烟。
4. **Windows 专用**：`findChrome()` 路径格式为 Windows 风格。Linux/Mac 需调整。

## 相关文件

| 文件 | 说明 |
|---|---|
| `scripts/smoke_test.mjs` | 通用冒烟测试引擎（多页面站模板） |
| `scripts/facetalk_smoke_test.mjs` | FaceTalk 单页应用专用测试（含交互+渐进式校验示例） |
