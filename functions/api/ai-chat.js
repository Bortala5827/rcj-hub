// /api/ai-chat —— AI 对话代理（内置 dots/agnes Key，支持自定义）
// 内置 Key 仅存在后端，前端不暴露。自定义模式由前端传参。

const BUILTIN = {
  dots: {
    baseUrl: "https://note3-prev-api.askdiandian.com/v1",
    model: "dots3-note-prev",
    apiKey: "ak_dxfPSu7FFgBmIzKUC6m3YLKMhHUP1"
  },
  agnes: {
    baseUrl: "https://apihub.agnes-ai.com/v1",
    model: "agnes-2.5-flash",
    apiKey: "sk-tjkkFISPVQ7WgIZr6TUhkNWaLO1ClPHvnv7rTTloUrf1HClZ"
  }
};

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
  return json({}, 204);
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "请求体不是合法 JSON" }, 400);
  }

  const provider = (body.provider || "").trim();
  const messages = body.messages || [];

  if (!Array.isArray(messages) || !messages.length) {
    return json({ error: "消息不能为空" }, 400);
  }

  // 内置系统提示词：简洁高效，不啰嗦
  const sysMsg = { role: "system", content: "你是简洁高效的 AI 助手。回答简明扼要，直击要点，不寒暄不废话。" };
  const finalMessages = [sysMsg].concat(messages);

  let baseUrl, model, apiKey;

  if (provider === "dots" || provider === "agnes") {
    const cfg = BUILTIN[provider];
    baseUrl = cfg.baseUrl;
    model = cfg.model;
    apiKey = cfg.apiKey;
  } else if (provider === "custom") {
    baseUrl = (body.baseUrl || "").trim();
    model = (body.model || "").trim();
    apiKey = (body.apiKey || "").trim();
    if (!baseUrl || !model || !apiKey) {
      return json({ error: "自定义模式需填接口地址、模型名、API Key" }, 400);
    }
  } else {
    return json({ error: "未知模型" }, 400);
  }

  const baseClean = baseUrl.replace(/\/+$/, "");
  const url = /\/chat\/completions$/i.test(baseClean)
    ? baseClean
    : `${baseClean}/chat/completions`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ model, messages: finalMessages, stream: false }),
    });
    const text = await res.text();
    if (!res.ok) {
      return json({ error: `HTTP ${res.status}: ${text.slice(0, 500)}` }, res.status);
    }
    const data = JSON.parse(text);
    const reply = data.choices?.[0]?.message?.content || "";
    return json({ reply });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
