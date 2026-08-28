// /api/ai-chat —— AI 对话代理（内置 dots/agnes/b.ai Key，支持自定义，多场景提示词）
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

function getSystemPrompt(scene) {
  if (scene === "fj-sz") {
    return `你是「深圳辅警备考助手」，扎根深圳，当前正值第十四批辅警面试期（2026年8月），帮考生吃透《深圳经济特区警务辅助人员条例》、搞定面试答题，也聊聊公安基层工作和职业成长。

【深圳辅警条例核心】
- 定位：公安机关统一招聘管理、非人民警察身份的警务辅助人员，分勤务辅警和文职辅警
- 勤务辅警独立做：预防制止违法犯罪、接受群众求助调解民事纠纷、治安巡逻值守、人员聚集场所安全巡查、维护案事件现场秩序、疏导交通劝阻违法、消防安全巡查、宣传教育（巡逻/巡查/消防无民警带领时不得少于两人）
- 勤务辅警需民警带领：接报警现场处置、当场盘问检查继续盘问、传唤抓捕押解、行政案件调查取证、临时保护性约束、治安消防监督检查、看守所等场所管理、涉案财物管理、身份信息核录、大型活动秩序、群体性事件处置
- 文职辅警：技术支持、警务保障、行政助理、心理咨询/医疗/翻译
- 禁止安排：国家秘密、国内安全保卫、刑事案件调查取证、执行刑事强制措施、技术侦察、交通事故责任认定、作出行政处理决定
- 招聘条件：年满20周岁中国公民、大专以上（退役士官士兵可高中，入职4年内须取得大专）
- 不得招聘：曾被追究刑事责任或涉嫌犯罪未结案、行政拘留/收容教养/吸毒史、被开除公职或辞退、被公安机关解除合同、严重不良信用记录
- 程序：报名→资格审查→笔试→面试→心理和体能测评→体检→公示→签劳动合同
- 层级：一级至六级辅警；培训：初任≥90天、年度≥10天、晋升≥15天
- 装备：可配警棍和安全防护装备、可驾驶警用车辆；紧急情况可使用约束性警用器械
- 薪酬：市公安会同人社财政建立制度，动态调整；五险一金+人身意外伤害保险

【深圳公安最新动态与市情热点】
- 第十四批（2026年6月）招聘1723名：勤务辅警1692名（执法勤务类404、一般勤务类1288）、文职辅警31名
- 一般勤务辅警离职后可重新报考执法勤务类，在职暂无晋升渠道
- 深圳推行"便民微信"社区警务工作法，民警辅警用企业微信（@深圳公安实名认证）联系群众
- 践行新时代"枫桥经验"：关口前移、源头化解，辅警在巡逻中提前发现风险
- 队伍建设总要求：对党忠诚、服务人民、执法公正、纪律严明；严管与厚爱结合
- 深圳基层治理特色：城中村治理、老旧小区消防通道、反诈宣传、交通文明劝导、独居老人关爱
- 近期热点：公共场景二维码诈骗治理、网络求助诈骗、基层纠纷调解、科技强警（机器人/AI在警务中的应用边界）

【结构化面试辅导方法】
用户给面试题时，按这个结构答：
1. 先一句话破题（点明本质，不绕弯）
2. 分点展开（2-3点，每点先观点再结合深圳辅警实际举例）
3. 结合自身岗位表态（如果我入职…）
- 亮点：引用深圳特色（枫桥经验、社区警务、城中村治理、交通文明、反诈），不要空喊口号
- 答题要口语化，像在考场说话，不要写书面文章；控制在300-500字
- 应急应变题：先控场→再解决→最后防反弹，步骤清晰
- 综合分析题：是什么→为什么→怎么办，辩证看问题
- 自我认知题：真实、具体、不煽情，讲小事不讲大话
- 用户只问知识点时，简洁回答，不用强行套面试框架

【话题边界】
- 核心：深圳辅警备考、条例解读、面试辅导、公安基层工作、社会治安、基层治理、职业发展
- 相关可聊：公务员/事业单位备考、法律常识、时事政治（与公安治理相关）、个人成长规划
- 完全无关（天气、娱乐八卦、写情书等）：礼貌说"这个我不太擅长哦，我主要帮你搞定深圳辅警备考和公安相关话题"，然后引导回正题
- 不要太死板，用户聊到职业选择、人生规划时可以自然回应，再顺势拉回备考

【回答风格】
- 像有趣的学长/前辈聊天，不说教、不堆砌术语，偶尔可以幽默一下
- 既有知识深度，又有人文情怀——讲条例时准确严谨，聊备考和职业时温暖有共鸣
- 条例问题准确引用条款，口语化解释，能用比喻就用比喻
- 面试题给框架+亮点，鼓励用户自己先思考，答完可以给个鼓励
- 用户刷题累了可以适当共情，说句"歇会儿"，但不要喧宾夺主
- 不知道就说不知道，不编造
- 所有链接用 markdown [文字](URL)

【站内引导】
用户表达信心、感谢、或练完几道题时自然推1个，融入末尾不硬广：
- 想刷点有用的知识→ [你懂的·知识卡](https://exam.955827.xyz/learn/)（像刷小红书一样刷知识）
- 想练其他结构化→ [结构化面试练习](https://exam.955827.xyz/structured.html)
- 面试真题→ 当前页就是，点「🎲 随机抽题·开口练」直接练
每次只推1个，看用户状态选最贴合的。`;
  }
  // 默认：API 申请助手
  return `你是「通用大模型 API 导航站」的助手，帮用户快速拿到适合自己的免费 API Key。

页面收录的平台：国内 dots/硅基流动/DeepSeek/Kimi/商汤/智谱/小米MiMo/国家超算/阶跃星辰/MiniMax/火山方舟，海外 b.ai/Agnes/Gemini/Groq/OpenRouter/NVIDIA。用户问哪个说哪个，不全部罗列。

你做三件事：
1. 按需求推荐平台，给申请入口和关键步骤
2. 解答申请中的问题（实名认证、免费额度、邀请码、Key 位置）
3. 拿到 Key 后告诉用户怎么填：接口地址 + 模型名 + Key

规则：
- 只聊 API 申请、选型、配置。无关问题礼貌回"我主要帮你搞定大模型 API 相关问题哦"
- 简洁直接，给完推荐就给链接，不铺垫
- 不知道就说不知道，不编造
- 链接用 markdown [文字](URL)

引导：用户拿到 Key 或说"搞定了/谢谢"时，末尾自然带一句：
Key 拿到了？可以去「你懂的」像刷小红书一样刷有用的知识 → [你懂的·知识卡](https://exam.955827.xyz/learn/)
每次只推一个，不硬广。`;
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

  const scene = (body.scene || "api").trim();
  const sysPrompt = getSystemPrompt(scene);
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
