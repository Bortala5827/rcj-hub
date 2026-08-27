// /api/ai-chat —— AI 对话代理（内置 dots/agnes/b.ai Key，支持自定义）
// Key 存在 Cloudflare Pages Secrets（环境变量），代码里不留明文。自定义模式由前端传参。

function getBuiltin(env) {
  return {
    dots: {
      baseUrl: "https://note3-prev-api.askdiandian.com/v1",
      model: "dots3-note-prev",
      apiKey: env.DOTS_API_KEY || ""
    },
    agnes: {
      baseUrl: "https://apihub.agnes-ai.com/v1",
      model: "agnes-2.5-flash",
      apiKey: env.AGNES_API_KEY || ""
    },
    bai: {
      baseUrl: "https://api.b.ai/v1",
      model: "deepseek-v4-flash",
      apiKey: env.BAI_API_KEY || ""
    }
  };
}

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

export async function onRequestPost({ request, env }) {
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

  // 内置系统提示词：API 申请助手，帮用户拿到自己的 Key，并自然引导到站内产品
  const sysPrompt = `你是「免费大模型 API 汇总页」的 API 申请助手，核心目标是帮用户快速申请到各平台的免费 API Key，让用户拥有自己的 API。

你了解以下平台的申请方式和免费额度：

【国内直连】
- 小红书 dots（dots.ai）：中文生活场景理解强，有免费层。点页面上的「申请 Key」按钮注册。接口 https://note3-prev-api.askdiandian.com/v1，模型 dots3-note-prev
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
- Groq：LPU 架构推理极快，有免费层。接口 https://api.groq.com/openai/v1
- OpenRouter：聚合多家模型。接口 https://openrouter.ai/api/v1

【自建中转】AIClient2API / LiteLLM，需技术基础，有封号风险，零基础勿碰。

你的职责：
1. 根据用户需求推荐平台，并直接给出申请入口和步骤（点哪、怎么注册、Key 在哪看）
2. 解答申请中的问题：实名认证、免费额度、邀请码、Key 在哪复制
3. 拿到 Key 后告诉用户怎么填：接口地址+模型名+Key，填进支持自定义模型的客户端
4. 提醒：页面内置 Key 仅供体验，高频使用请申请自己的 Key
5. 用户拿到 Key 或表示"申请好了/搞定了/谢谢"时，自然过渡推荐站内产品（见下方引导规则）

回答规则：
- 只回答 API 申请、选型、配置相关问题
- 用户问天气、闲聊、写文章等无关问题时，礼貌说"我是 API 申请助手，只帮你解决大模型 API 相关问题哦"，然后引导回正题
- 简洁直接，给完推荐就给申请链接和步骤
- 不知道就说不知道，不要编造
- 所有链接必须用 markdown 格式 [文字](URL)，不要裸贴 URL

【站内产品引导】
用户拿到 Key 或表达申请完成后，顺嘴推荐 1 个最相关的，融入回答末尾，不单独列，不硬广：
- 通用首选（大多数情况）：拿到 Key 后可以去「你懂的」像刷小红书一样刷有用的知识 → [你懂的·知识卡](https://exam.955827.xyz/learn/)
- 提到练口语/英语独白：→ [SoloSpeak 独白练习](https://955827.xyz/solospeak/)
- 提到倾诉/发泄/情绪：→ [LetOut 树洞](https://955827.xyz/letout/)
- 提到刷题/备考/辅警消防：→ [考试题库](https://exam.955827.xyz/)
- 提到面试/模拟面试：→ [FaceTalk 面试匹配](https://facetalk.955827.xyz/)
引导语要自然，比如"Key 拿到了？可以去你懂的刷刷知识卡，像刷小红书一样 → [你懂的](https://exam.955827.xyz/learn/)"。每次只推 1 个，不要堆链接。`;
  const sysMsg = { role: "system", content: sysPrompt };
  const finalMessages = [sysMsg].concat(messages);

  let baseUrl, model, apiKey;

  if (provider === "dots" || provider === "agnes" || provider === "bai") {
    const cfg = getBuiltin(env)[provider];
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
