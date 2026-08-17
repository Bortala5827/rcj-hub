// ai-settings.js — 复用辅警站 AI 设置架构（自备 Key，本地优先）
// 移植自 FuJingGITHUB/shared/app.js 的 AI 设置块：同样的存储结构 / 同样的调用方式。
// 暴露 window.RCJ_AI：load() / save() / callLlm() / testConnection() / openSettings() / mountAiGuide()
// 设计原则（与产品一致）：不收集、不上传，Key 只存在用户浏览器本地；分析在本机发起。

(function () {
  // 独立 key，避免与辅警站 rcj_web_asr_v1 冲突；数据结构保持一致（llm 部分）
  var KEY = 'rcj_solospeak_ai_v1';

  function defaults() {
    return { enabled: false, baseUrl: '', key: '', model: '' };
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || '{}');
      return Object.assign(defaults(), s);
    } catch (e) { return defaults(); }
  }

  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  function normalizeBaseUrl(u) {
    u = (u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return u.replace(/\/+$/, '');
  }

  function fetchWithTimeout(url, opts, ms) {
    ms = ms || 30000;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error('请求超时（' + Math.round(ms / 1000) + '秒未响应）'));
      }, ms);
      var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var inner = controller ? setTimeout(function () { try { controller.abort(); } catch (_e) {} }, ms) : null;
      fetch(url, controller ? Object.assign({}, opts, { signal: controller.signal }) : opts)
        .then(function (res) { clearTimeout(timer); if (inner) clearTimeout(inner); resolve(res); })
        .catch(function (err) { clearTimeout(timer); if (inner) clearTimeout(inner); reject(err); });
    });
  }

  // 调 LLM，返回纯文本（兼容 OpenAI / 硅基流动 / DeepSeek / 通义 等 /chat/completions 协议）
  function callLlm(opts) {
    var s = load();
    if (!s.enabled || !s.key || !s.baseUrl || !s.model) {
      return Promise.reject(new Error('AI 未配置：请点 ⚙️ 填入 API Base URL / Key / 模型名并启用。'));
    }
    var url = normalizeBaseUrl(s.baseUrl) + '/chat/completions';
    var body = {
      model: s.model,
      messages: [
        { role: 'system', content: opts.system || '' },
        { role: 'user', content: opts.user || '' }
      ],
      temperature: (opts.temperature != null) ? opts.temperature : 0.6,
      max_tokens: opts.maxTokens || 800,
      stream: false
    };
    return fetchWithTimeout(url, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.key },
      body: JSON.stringify(body)
    }, opts.timeout || 30000).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + '：' + t.slice(0, 200)); });
      return r.json();
    }).then(function (data) {
      var txt = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      if (!txt) throw new Error('模型返回为空，可能是模型名在该平台未开通，换一个试试。');
      return txt;
    });
  }

  // 测试连接：两步探测 /models + /chat/completions（与辅警站一致）
  function testConnection() {
    var s = load();
    if (!s.key) return Promise.reject(new Error('请先填 API Key'));
    if (!s.model) return Promise.reject(new Error('请先填模型名'));
    if (!s.baseUrl) return Promise.reject(new Error('请先填 API Base URL'));
    var baseUrl = normalizeBaseUrl(s.baseUrl);
    var modelsUrl = baseUrl + '/models';
    var chatUrl = baseUrl + '/chat/completions';
    return fetchWithTimeout(modelsUrl, { method: 'GET', mode: 'cors', headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + s.key } }, 6000)
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status + '：探测 /models 失败'); return res; })
      .then(function () {
        return fetchWithTimeout(chatUrl, {
          method: 'POST', mode: 'cors',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.key },
          body: JSON.stringify({ model: s.model, messages: [{ role: 'user', content: '你好' }], max_tokens: 5, stream: false })
        }, 10000);
      })
      .then(function (res) {
        if (!res.ok) {
          if (res.status === 401) throw new Error('HTTP 401：API Key 无效或已过期');
          if (res.status === 403) throw new Error('HTTP 403：没有该模型访问权限');
          if (res.status === 429) throw new Error('HTTP 429：请求频繁或余额不足');
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function (j) {
        var ans = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
        return ans ? ('连接成功！模型回复：' + ans.slice(0, 30)) : '连接成功但返回为空（模型名可能不对）';
      });
  }

  // ===== 设置弹层 =====
  function openSettings() {
    var s = load();
    var ov = document.getElementById('aiSettingsOverlay');
    if (!ov) return;
    document.getElementById('aiEnabled').checked = !!s.enabled;
    document.getElementById('aiBaseUrl').value = s.baseUrl || '';
    document.getElementById('aiApiKey').value = s.key || '';
    document.getElementById('aiModel').value = s.model || '';
    var res = document.getElementById('aiTestResult');
    if (res) res.textContent = '';
    ov.classList.add('show');
  }
  function closeSettings() {
    var ov = document.getElementById('aiSettingsOverlay');
    if (ov) ov.classList.remove('show');
  }

  function wire() {
    var ov = document.getElementById('aiSettingsOverlay');
    if (!ov) return;
    var btn = document.getElementById('aiSettingsBtn');
    var saveBtn = document.getElementById('aiSettingsSave');
    var closeBtn = document.getElementById('aiSettingsClose');
    var testBtn = document.getElementById('aiTestBtn');
    var toggleBtn = document.getElementById('aiDetailToggle');
    var detailBody = document.getElementById('aiDetailBody');
    if (btn) btn.addEventListener('click', openSettings);
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeSettings(); });
    // 折叠/展开详细配置
    if (toggleBtn && detailBody) {
      toggleBtn.addEventListener('click', function () {
        var open = detailBody.classList.toggle('open');
        toggleBtn.textContent = open ? '收起配置 ▴' : '展开配置 ▾';
      });
      // 启用 AI 时自动展开
      document.getElementById('aiEnabled').addEventListener('change', function (e) {
        if (e.target.checked && !detailBody.classList.contains('open')) {
          detailBody.classList.add('open');
          toggleBtn.textContent = '收起配置 ▴';
        }
      });
    }

    if (saveBtn) saveBtn.addEventListener('click', function () {
      var s = {
        enabled: document.getElementById('aiEnabled').checked,
        baseUrl: document.getElementById('aiBaseUrl').value.trim(),
        key: document.getElementById('aiApiKey').value.trim(),
        model: document.getElementById('aiModel').value.trim()
      };
      if (s.enabled && !s.baseUrl) { alert('已启用 AI 引导，但缺少 API Base URL'); return; }
      if (s.enabled && !s.key) { alert('已启用 AI 引导，但缺少 API Key'); return; }
      if (s.enabled && !s.model) { alert('已启用 AI 引导，但缺少模型名'); return; }
      save(s);
      closeSettings();
    });

    if (testBtn) testBtn.addEventListener('click', function () {
      // 先把当前填写的临时值存一下再测（不强制用户点保存）
      var draft = {
        enabled: document.getElementById('aiEnabled').checked,
        baseUrl: document.getElementById('aiBaseUrl').value.trim(),
        key: document.getElementById('aiApiKey').value.trim(),
        model: document.getElementById('aiModel').value.trim()
      };
      save(draft);
      var resEl = document.getElementById('aiTestResult');
      resEl.style.color = '#6b7280'; resEl.textContent = '⏳ 正在测试连接…';
      testConnection().then(function (msg) {
        resEl.style.color = '#059669'; resEl.textContent = '✅ ' + msg;
      }).catch(function (err) {
        var m = String(err.message || err);
        if (/timeout|超时/i.test(m)) resEl.textContent = '❌ 超时：检查 URL、网络与代理';
        else if (/Failed to fetch|NetworkError|CORS/i.test(m)) resEl.textContent = '❌ 网络失败：URL 需 https:// 开头且本机可访问外网';
        else resEl.textContent = '❌ ' + m;
        resEl.style.color = '#dc2626';
      });
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 把「AI 引导」挂到某个容器（如录音结束反馈卡）
  function mountAiGuide(el, ctx) {
    if (!el) return;
    var s = load();
    if (!s.enabled || !s.key || !s.baseUrl || !s.model) {
      el.innerHTML = '<div class="ai-guide-locked">想让 AI 给你一点引导？' +
        '<button class="link-btn" id="aiUnlock">填一个自备 Key</button>' +
        '<div class="ai-guide-tip">数据不出本机，Key 只存在你浏览器里。</div></div>';
      var ub = document.getElementById('aiUnlock');
      if (ub) ub.addEventListener('click', openSettings);
      return;
    }
    el.innerHTML = '' +
      '<div class="ai-guide-ready">' +
      '<div class="ai-guide-title">✨ AI 引导（自备 Key · 不评分）</div>' +
      '<textarea class="ai-note" id="aiNote" placeholder="想对 AI 说点什么？（可选：比如今天想练什么、卡在哪）"></textarea>' +
      '<button class="big-btn ai-go" id="aiGo">让 AI 引导一下</button>' +
      '<div class="ai-result" id="aiResult" hidden></div>' +
      '</div>';
    var go = document.getElementById('aiGo');
    var result = document.getElementById('aiResult');
    var note = document.getElementById('aiNote');
    go.addEventListener('click', function () {
      var sys = '你是「独声 SoloSpeak」的陪伴式引导者。这是一个本地优先、不评分、鼓励开口的独处说话练习产品。用户对着自己说话/练习表达，目的是保持语言系统在线、缓解长期不说话的生疏感。\n' +
        '请基于这次开口的【客观数据】和【用户可选的补充留言】，给出温柔、具体、不评判的引导，严格按以下三段、不超过 220 字输出：\n' +
        '①【肯定】用一句话肯定这次开口本身（无论长短、无论质量），强调“开口就赢了”。\n' +
        '②【观察】就数据给一个不评判的观察（如：这次音量偏低，可能还比较拘谨；或这次有放得很开的高音量，状态在打开）——只描述，不打分。\n' +
        '③【一个小建议】给一个今天就能做的微小练习（如：下次开口前先深吸一口气；或就这个话题再多说 30 秒）。\n' +
        '要求：语气像安静的同伴，不催、不夸、不吓；绝不打分、绝不比较；不出现“应该”“必须”“不够”等评判词。';
      var lvl = ctx.level || {};
      var peakPct = Math.round((lvl.max || 0) * 100);
      var user = '【本次开口数据】\n' +
        '时长：' + Math.round((ctx.durationMs || 0) / 1000) + ' 秒\n' +
        '话题：' + (ctx.topicText || '（无）') + '\n' +
        '音量峰值：' + peakPct + '%\n' +
        '橙色高音量（放得很开）：' + (lvl.highTriggered ? '出现过' : '未出现') + '\n\n' +
        '【用户补充（可选）】\n' + (note.value.trim() || '（无）');
      result.hidden = false;
      result.innerHTML = '<div class="ai-loading">⏳ AI 引导生成中…（取决于你的网络与模型速度）</div>';
      go.disabled = true;
      callLlm({ system: sys, user: user, maxTokens: 600, temperature: 0.7 }).then(function (txt) {
        result.innerHTML = '<div class="ai-body">' + esc(txt).replace(/\n/g, '<br>') + '</div>';
      }).catch(function (err) {
        result.innerHTML = '<div class="ai-err">⚠️ AI 引导失败：' + esc(err.message) +
          '<br><br>排查：①Key 是否正确；②账户是否有额度；③模型是否可访问；④浏览器能否访问该 API 域名（国内直连优先选硅基流动）。</div>';
      }).finally(function () { go.disabled = false; });
    });
  }

  window.RCJ_AI = {
    load: load, save: save, callLlm: callLlm,
    testConnection: testConnection,
    openSettings: openSettings, closeSettings: closeSettings,
    mountAiGuide: mountAiGuide, wire: wire
  };

  if (document.readyState !== 'loading') wire();
  else document.addEventListener('DOMContentLoaded', wire);
})();
