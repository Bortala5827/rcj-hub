// /api/probe —— 通用连通性探针（与 exam 站 relate_probe 同源逻辑，仅验证连通性）
// 前端「免费 API 汇总页」「你懂的·自定义模型」复用此端点，不发真实业务请求。
// 仅接受自定义 OpenAI 兼容源：baseUrl + model + apiKey，最小请求验证能否通。

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "请求体不是合法 JSON" }, 400);
  }

  const BASE = (body.baseUrl || "").trim();
  const MODEL = (body.model || "").trim();
  const API_KEY = (body.apiKey || "").trim();

  if (!BASE || !MODEL || !API_KEY) {
    return json({ ok: false, error: "接口地址、模型名、API Key 三项齐全才能测试" }, 400);
  }

  // 基础校验：仅 https + 禁止指向本地/内网
  let parsedUrl;
  try {
    parsedUrl = new URL(BASE);
    if (parsedUrl.protocol !== "https:") {
      return json({ ok: false, error: "接口地址仅支持 https", url: BASE }, 400);
    }
    const host = parsedUrl.hostname;
    const blocked =
      host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" ||
      host.endsWith(".internal") || host.endsWith(".local") ||
      host.startsWith("192.168.") || host.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (blocked) {
      return json({ ok: false, error: "接口地址不允许指向本地或内网", url: BASE }, 400);
    }
  } catch (e) {
    return json({ ok: false, error: "接口地址格式不正确", url: BASE }, 400);
  }

  // URL 拼接：若已含 /chat/completions 不再重复拼（避免双倍拼接 404）
  const baseClean = BASE.replace(/\/+$/, "");
  const url = /\/chat\/completions$/i.test(baseClean)
    ? baseClean
    : `${baseClean}/chat/completions`;

  try {
    const probePayload = {
      model: MODEL,
      messages: [{ role: "user", content: "ping" }],
      temperature: 0,
      max_tokens: 5,
      stream: false,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(probePayload),
    });
    const status = res.status;
    const text = await res.text();
    if (!res.ok) {
      return json(
        { ok: false, error: `HTTP ${status}: ${text.slice(0, 300)}`, url, model: MODEL },
        status
      );
    }
    let echoModel = MODEL;
    try {
      const d = JSON.parse(text);
      if (d.model) echoModel = d.model;
    } catch (e2) {}
    return json({ ok: true, url, model: echoModel, sample: text.slice(0, 120) });
  } catch (err) {
    return json({ ok: false, error: err.message, url, model: MODEL }, 500);
  }
}
