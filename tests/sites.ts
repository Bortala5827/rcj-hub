/**
 * 测试目标站点清单（单一事实来源）
 * ---------------------------------------------------------------
 * RCJ_HUB_PAGES：rcj-hub 仓库自身承载的「主站 + 子路径」，
 *   既可在本地静态服务下测试，也可指向线上域名（设 BASE_URL=https://955827.xyz）。
 * ECOSYSTEM_LIVE：生态内的独立子站（不同仓库 / 子域），
 *   仅在本地显式开启 TEST_LIVE_ECOSYSTEM=1 时纳入（CI 默认不命中线上站点）。
 *
 * 新增站点 / 子路径：改这里即可，无需动测试逻辑。
 */

export interface SitePage {
  name: string;
  /** 相对路径（基于 baseURL），用于 rcj-hub 自身页面 */
  path?: string;
  /** 绝对 URL，用于线上子站 */
  url?: string;
  /** 是否含麦克风音频能力（SoloSpeak / LetOut） */
  hasAudio?: boolean;
  /** 是否为 PWA（含 manifest + Service Worker） */
  isPWA?: boolean;
}

export const RCJ_HUB_PAGES: SitePage[] = [
  { name: 'RCJ Hub 首页（RCJ Lab 品牌枢纽）', path: '/' },
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
 * 这些不是站点 Bug，而是依赖 Cloudflare 运行时，明确标记、不计入失败。
 */
export const KNOWN_RUNTIME_PATHS = ['/api/', '/cdn-cgi/'];
