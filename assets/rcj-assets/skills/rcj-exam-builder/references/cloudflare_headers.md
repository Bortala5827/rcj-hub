# Cloudflare Pages 缓存与响应头（_headers）

把数据文件外置后，靠响应头让"外壳秒开 + 数据长期缓存"生效。Cloudflare Pages 读取仓库根目录的
`_headers` 文件（纯文本，按路径块配置）。

## 一、推荐 `_headers`（直接抄）

```text
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin

/*.html
  Cache-Control: public, max-age=300

/data-written.js
  Cache-Control: public, max-age=3600, s-maxage=86400

/data-interview.js
  Cache-Control: public, max-age=3600, s-maxage=86400

/config.js
  Cache-Control: public, max-age=3600, s-maxage=86400

# 图片：no-cache = 每次使用前用 ETag 向服务器校验；换图后原地覆盖同名文件即可，
# push 后浏览器自动拉新图，无需加 ?v= 版本号，也无需强刷（Ctrl+F5）
/*.png
  Cache-Control: no-cache
/*.jpg
  Cache-Control: no-cache
/*.jpeg
  Cache-Control: no-cache
/*.webp
  Cache-Control: no-cache
```

要点：
- `/*` 全局安全头（防 MIME 嗅探、防被 iframe 嵌套）。
- `/*.html` 短缓存（`max-age=300`=5 分钟）：便于你改文案/功能后快速生效。
- `data-*.js` / `config.js` 逐文件列出，`max-age=3600`（浏览器 1 小时校验）+ `s-maxage=86400`（CDN 缓存 1 天）。改题后最迟 1 小时生效，无需改文件名。
- 图片用 `no-cache`：每次使用前用 ETag 校验，换图 push 后自动更新。

> **为什么不推荐 `immutable`**：`immutable` 告诉浏览器"这文件永不改，别来问我"。
> 但你的题库会更新——一旦设了 `immutable`，浏览器不会再来校验，用户看到的永远是旧数据，
> 除非你改文件名（如 `data-written.v2.js`）并同步改 HTML 引用。
> 用 `max-age=3600, s-maxage=86400` 代替：浏览器每小时校验一次，CDN 缓存一天，
> 兼顾加载速度和数据新鲜度。

## 二、为什么本 skill 不用 immutable

`immutable` = 告诉浏览器"这文件永不改，别来问我"。因此：
- **只用于真正不变的文件**（hash 命名资源如 `app.a1b2c3d4.js`）。
- 题库数据会更新，文件名不变 → 设 `immutable` 后浏览器一直用旧缓存，用户看到过期数据。
- 本 skill 的 `_headers` 用 `max-age=3600, s-maxage=86400` 替代：浏览器每小时校验一次，CDN 缓存一天。
  改题后最迟 1 小时生效，无需改文件名。

## 三、preload 提前拉取

在外置数据文件较大时，让浏览器在解析 HTML 的同时并行下载它：

```html
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preload" as="script" href="data-written.js">
</head>
```

`extract_data.py` 会自动插入这一行；手写时确保 href 与 `<script src>` 文件名一致。

## 四、校验清单（上线前必跑）

```bash
# 1) 数据文件语法
node --check data-written.js
node -e "global.window={};require('./data-written.js');console.log('条数',window.DATA.length)"

# 2) <script> 标签配对：开标签数 === 闭标签数
grep -c '<script' index.html; grep -c '</script>' index.html

# 3) 内联脚本内部不得再出现 </script>（否则浏览器提前结束脚本 → 整页 JS 失效）
#    把每个无 src 的内联块抽出来搜 </script>，应为 0 处

# 4) HTML 内已无残留内联大数组
grep -c 'var DATA = \[' index.html   # 应为 0
```

## 五、本地预览（file:// 也能跑）

外置后用 `<script src="data.js">` 的页面，直接双击 `index.html` 即可离线打开（不需服务器）。
若改用 `fetch('data.json')` 方式，则必须起本地服务：

```bash
python -m http.server 8080   # 然后访问 http://localhost:8080/
```
