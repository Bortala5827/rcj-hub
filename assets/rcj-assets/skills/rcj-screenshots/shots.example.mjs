// 自定义截图配置示例 —— 复制改名后: node screenshot.js ./my-shots.mjs
export const shots = [
  { url: 'https://facetalk.955827.xyz/', name: 'facetalk-desktop.png', desc: 'FaceTalk 桌面', viewport: { width: 1280, height: 820 } },
  { url: 'https://facetalk.955827.xyz/', name: 'facetalk-mobile.png',  desc: 'FaceTalk 移动', viewport: { width: 390, height: 844 }, fullPage: true },
  { url: 'https://955827.xyz/',    name: 'hub-mobile.png',       desc: 'Hub 移动端',   viewport: { width: 390, height: 844 }, fullPage: true },
];
export const outDir = 'screenshots';
