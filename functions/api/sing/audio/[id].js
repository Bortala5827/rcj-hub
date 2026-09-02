// Sing to Me · 播放语音（需登录）
//   GET /api/sing/audio/<id>  → 从 R2 读取 <id>.webm 并返回音频流
//
// 为什么单独建这个文件：
//   Cloudflare Pages Functions 按**文件路径**路由，functions/api/sing.js 只能
//   匹配 /api/sing，匹配不到 /api/sing/audio/<id> —— 请求会被回退到静态首页
//   （返回 200 + HTML），导致后台 <audio> 拿到 HTML 而无法播放。
//   故此处用动态路由 [id].js 精确匹配该子路径。
import { verifyAuth, json, cors } from '../_auth.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function onRequestGet({ request, env, params }) {
  if (!(await verifyAuth(request, env))) return json({ ok: false, error: '未登录' }, 401);

  const id = String((params && params.id) || '').trim();
  // 仅允许安全字符，避免拼出异常 R2 key
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return json({ ok: false, error: 'id 非法' }, 400);

  if (!env.SING_R2) return json({ ok: false, error: 'R2 未绑定' }, 500);

  const key = id + '.webm';
  let obj;
  try {
    obj = await env.SING_R2.get(key);
  } catch (e) {
    return json({ ok: false, error: '读取语音失败：' + e.message }, 500);
  }
  if (!obj) return new Response('not found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'audio/webm',
      'Cache-Control': 'no-store',
    },
  });
}
