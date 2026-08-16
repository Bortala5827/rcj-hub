/**
 * 测试目标站点清单（单一事实来源）
 * 改这里即可增减被测页面，无需动测试逻辑。
 */

export interface SitePage {
  name: string;
  path?: string;       // 相对路径（基于 baseURL），用于本仓库自身页面
  url?: string;        // 绝对 URL，用于线上子站
  hasAudio?: boolean;  // 是否含麦克风音频能力
  isPWA?: boolean;     // 是否为 PWA
}

export const RCJ_HUB_PAGES: SitePage[] = [
  { name: '首页', path: '/' },
  { name: '资产库页', path: '/assets.html' },
  { name: '归档页', path: '/archive.html' },
  { name: '原则页', path: '/principles.html' },
  { name: 'SoloSpeak 子路径（含音频）', path: '/solospeak/', hasAudio: true },
  { name: 'LetOut 子路径（含音频）', path: '/letout/', hasAudio: true },
  { name: '训练指南内容页', path: '/training/' },
];

export const ECOSYSTEM_LIVE: SitePage[] = [
  { name: 'FaceTalk 子站', url: 'https://facetalk.955827.xyz/' },
  { name: '辅警题库子站', url: 'https://fj.955827.xyz/' },
  { name: '消防题库子站', url: 'https://xf.955827.xyz/' },
  { name: 'Exam Hub 子站', url: 'https://exam.955827.xyz/' },
];

/** 本地是否纳入线上子站（CI 默认 false） */
export const INCLUDE_ECOSYSTEM = !!process.env.TEST_LIVE_ECOSYSTEM;

/**
 * 已知在「本地静态服务」下不可用的 CF Pages Functions 路由。
 * 依赖 Cloudflare 运行时，明确标记、不计入失败。
 */
export const KNOWN_RUNTIME_PATHS = ['/api/', '/cdn-cgi/'];
