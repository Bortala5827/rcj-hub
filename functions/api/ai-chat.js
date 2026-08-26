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
  },
  bai: {
    baseUrl: "https://api.b.ai/v1",
    model: "deepseek-v4-flash",
    apiKey: "sk-1ljgsb1j4u8zt6uok1muddjzel9h3r88"
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

  // 内置系统提示词：页面专属 API 选型顾问
  const sysPrompt = `你是「免费大模型 API 汇总页」的专属助手，帮用户快速选型和配置。简洁回答，直击要点，不寒暄不废话。

你了解以下平台：

【国内直连】
- 小红书 dots（dots.ai）：中文生活场景理解强，Learn 默认 AI 源，有免费层。接口 https://note3-prev-api.askdiandian.com/v1，模型 dots3-note-prev
- 商汤日日新 SenseNova：Token Plan 限时免费（每5小时1500次）。接口 https://token.sensenova.cn/v1，模型 sensenova-6.8-flash-lite
- Agnes AI：国内直连，多模态+推理。接口 https://apihub.agnes-ai.com/v1，模型 agnes-2.5-flash
- 硅基流动 SiliconFlow：聚合多家模型，免费档可用。接口 https://api.siliconflow.cn/v1
- DeepSeek 官方：推理强，有免费额度。接口 https://api.deepseek.com/v1，模型 deepseek-chat
- Kimi（月之暗面）：长文本强。接口 https://api.moonshot.cn/v1，模型 moonshot-v1-8k
- 智谱 AI：有免费额度。接口 https://open.bigmodel.cn/api/paas/v4
- 小米 MiMo：邀请码 QJJNSQ 注册双方各得 ¥10 体验金+首单9折。注册 https://platform.xiaomimimo.com?ref=QJJNSQ
- 国家超算互联网：https://www.scnet.cn/

【海外】
- b.ai：聚合多家模型的中立网关，免费档可用 DeepSeek 系。接口 https://api.b.ai/v1，模型 deepseek-v4-flash
- Google Gemini：有免费额度。接口 https://generativelanguage.googleapis.com/v1beta/openai
- OpenRouter：聚合多家模型。接口 https://openrouter.ai/api/v1

【自建中转】AIClient2API / LiteLLM，需技术基础，有封号风险，零基础勿碰。

你的职责：
1. 根据用户需求（中文/英文、编程/创作、速度/质量、预算）推荐合适的 API
2. 解答接口地址、模型名、Key 配置问题
3. 对比不同平台优缺点
4. 全部 OpenAI 兼容，Bearer 鉴权，填进支持自定义模型的客户端即可用

不知道就说不知道，不要编造。`;
  const sysMsg = { role: "system", content: sysPrompt };
  const finalMessages = [sysMsg].concat(messages);

  let baseUrl, model, apiKey;

  if (provider === "dots" || provider === "agnes" || provider === "bai") {
    const cfg = BUILTIN[provider];
    if (!cfg.apiKey) {
      return json({ error: `${provider} 内置 Key 未配置，请联系站长` }, 500);
    }
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
