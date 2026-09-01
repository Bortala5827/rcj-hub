// i18n.js — LetOut 三语字典（中 / 英 / 日）
// 默认英文；切换存 localStorage。页面加载时自动替换 [data-i18n] 元素。
(function () {
  const DICT = {
    en: {
      brand: 'LetOut',
      brandSub: 'Let It Out',
      navRelease: 'Release',
      navLog: 'Vault',
      navAbout: 'About',
      footerSlogan: 'Speaking itself is a kind of power.',
      footerCopy: '© 2026 RCJ9527 · Release, not vent',
      voiceLabel: 'Voice Texture',
      keepAudio: 'Keep this audio (off by default — burn after reading)',
      recAria: 'Tap to start releasing',
      recHintDefault: 'Say whatever comes to mind. No audience here, just your own voice.',
      logEmpty: 'Nothing released yet.<br>Go to Release and give yourself a chance to speak.',
      logTitle: 'Release Records ({n})',
      deleteConfirm: 'Delete this release? This cannot be undone.',
      deleteBtn: 'Delete',
      aboutTitle: 'About LetOut',
      aboutSub: 'LetOut — a place to speak your mind',
      aboutDesc1: 'When something is stuck in your chest, say it out loud. No judgment, no audience, no traces.',
      aboutDesc2: 'Choose a mood, press record, and let it out. Audio is deleted by default — only kept if you choose to.',
      aboutDesc3: 'The waveform and particles are here for one reason: so you can see your voice taking shape as you speak.',
      aboutFoot: 'LetOut is part of Speak Series.',
      // 4 moods
      emotionBurn: 'Burn',
      emotionRelease: 'Release',
      emotionSettle: 'Settle',
      emotionQuiet: 'Quiet',
      burnHint: 'Pour out that fire in your chest. Pause, repeat, get more urgent — all fine.',
      releaseHint: 'Say whatever comes to mind. No audience here, just your own voice.',
      settleHint: 'Slowly sort out the messy thoughts. No rush, one sentence at a time.',
      quietHint: 'You don\'t have to speak. Just be here, quietly, for a moment.',
      // burn voices
      burnVoice1: 'Smolder', burnVoice2: 'Flare Up', burnVoice3: 'Vent', burnVoice4: 'Fret', burnVoice5: 'Roar',
      // release voices
      releaseVoice1: 'Confide', releaseVoice2: 'Rant', releaseVoice3: 'Shout', releaseVoice4: 'Sigh', releaseVoice5: 'Let Go',
      // settle voices
      settleVoice1: 'Sort', settleVoice2: 'Monologue', settleVoice3: 'Clarify', settleVoice4: 'Mutter', settleVoice5: 'Settle',
      // quiet voices
      quietVoice1: 'Breathe', quietVoice2: 'Murmur', quietVoice3: 'Daydream', quietVoice4: 'Silence', quietVoice5: 'White Noise',
      // ghost guides (16)
      ghost1: 'Say whatever comes to mind.',
      ghost2: 'Who do you want to curse the most today?',
      ghost3: 'And who do you want to thank the most?',
      ghost4: 'If you could shout one thing, what would it be?',
      ghost5: 'If you don\'t say it, leave it to tonight\'s dream.',
      ghost6: 'It doesn\'t have to be coherent. Broken is fine.',
      ghost7: 'Say the words you swallowed back.',
      ghost8: 'Where in your body feels tight right now?',
      ghost9: 'Pour out the grievance into the air.',
      ghost10: 'Singing two lines is fine too, even off-key.',
      ghost11: 'You don\'t owe anyone an explanation.',
      ghost12: 'Just stay here, even for ten seconds.',
      ghost13: 'What are you most afraid of saying out loud?',
      ghost14: 'Say it like no one is listening — because no one is.',
      ghost15: 'Let your voice shake. Let it crack. It\'s okay.',
      ghost16: 'You came here to release, not to perform.',
    },
    zh: {
      brand: 'LetOut',
      brandSub: '大声说',
      navRelease: '释放',
      navLog: '库房',
      navAbout: '关于',
      footerSlogan: '开口，本身就是一种力量。',
      footerCopy: '© 2026 RCJ9527 · 释放，不是发泄',
      voiceLabel: '声纹',
      keepAudio: '保留这段音频（默认不保留，阅后即焚）',
      recAria: '点击开始释放',
      recHintDefault: '想说什么就说什么。这里没有观众，只有你自己的声音。',
      logEmpty: '还没有释放过。<br>回到「释放」，给自己一次开口的机会。',
      logTitle: '释放记录（{n}）',
      deleteConfirm: '删除这条释放？此操作不可恢复。',
      deleteBtn: '删除',
      aboutTitle: '关于 LetOut',
      aboutSub: 'LetOut · 大声说 — 一个把话说出来的地方',
      aboutDesc1: '堵在胸口的东西，说出来。不评价、没观众、不留痕。',
      aboutDesc2: '选个情绪，按一下录音，倒出来。音频默认删除——只有你选择保留才会留下。',
      aboutDesc3: '波形和粒子在这里只有一个原因：让你看到自己的声音在说话时成形。',
      aboutFoot: 'LetOut 是 Speak Series · 开口系列 的一款。',
      emotionBurn: '燃',
      emotionRelease: '释放',
      emotionSettle: '沉淀',
      emotionQuiet: '安静',
      burnHint: '把堵在胸口的那股火，一股脑倒出来。停顿、重复、越说越急，都可以。',
      releaseHint: '想说什么就说什么。这里没有观众，只有你自己的声音。',
      settleHint: '慢慢把乱糟糟的念头理顺。不急，一句一句来。',
      quietHint: '不说话也行。就在这里，安静地待一会儿。',
      burnVoice1: '闷烧', burnVoice2: '发火', burnVoice3: '宣泄', burnVoice4: '急躁', burnVoice5: '咆哮',
      releaseVoice1: '倾诉', releaseVoice2: '吐槽', releaseVoice3: '呐喊', releaseVoice4: '长叹', releaseVoice5: '痛快',
      settleVoice1: '梳理', settleVoice2: '独白', settleVoice3: '理清', settleVoice4: '喃喃', settleVoice5: '沉淀',
      quietVoice1: '呼吸', quietVoice2: '呢喃', quietVoice3: '发呆', quietVoice4: '沉默', quietVoice5: '白噪音',
      ghost1: '想到什么就说什么。',
      ghost2: '今天最想骂的人，是谁？',
      ghost3: '今天最想感谢的，又是谁？',
      ghost4: '如果大喊一声，你会喊什么？',
      ghost5: '不说出来，就留给今晚的梦。',
      ghost6: '不用连贯，破碎也没关系。',
      ghost7: '把那句咽回去的话，说出来。',
      ghost8: '此刻你身体哪里是紧的？',
      ghost9: '对着空气，把委屈倒出来。',
      ghost10: '唱两句也行，跑调也没关系。',
      ghost11: '你不需要向谁交代。',
      ghost12: '就在这里，哪怕只待十秒。',
      ghost13: '你最不敢大声说出口的是什么？',
      ghost14: '就当没人在听——因为确实没人。',
      ghost15: '让声音抖吧。破音也没关系。',
      ghost16: '你来这里是为了释放，不是表演。',
    },
    ja: {
      brand: 'LetOut',
      brandSub: 'レットアウト',
      navRelease: '解放',
      navLog: '記録',
      navAbout: 'について',
      footerSlogan: '口を開くこと自体が、一つの力。',
      footerCopy: '© 2026 RCJ9527 · 解放であって、発散ではない',
      voiceLabel: '声紋',
      keepAudio: 'この音声を残す（デフォルトはオフ・読んだら消す）',
      recAria: 'タップして解放開始',
      recHintDefault: '思いつくままに話そう。ここに聴衆はいない、自分の声だけ。',
      logEmpty: 'まだ解放していません。<br>「解放」に戻って、一回口を開いてみよう。',
      logTitle: '解放記録（{n}）',
      deleteConfirm: 'この解放を削除しますか？元に戻せません。',
      deleteBtn: '削除',
      aboutTitle: 'LetOutについて',
      aboutSub: 'LetOut · レットアウト — 言葉を吐き出す場所',
      aboutDesc1: '胸につっかえているもの、声に出そう。評価もない、聴衆もない、痕跡も残らない。',
      aboutDesc2: '気分を選んで、録音ボタンを押して、吐き出す。音声はデフォルトで削除——残したい時だけ残る。',
      aboutDesc3: '波形と粒子がここにある理由はただ一つ：話している自分の声が形になるのを見るため。',
      aboutFoot: 'LetOutは Speak Series の一つです。',
      emotionBurn: '燃',
      emotionRelease: '解放',
      emotionSettle: '沈静',
      emotionQuiet: '静',
      burnHint: '胸につっかえたその火を、一気に吐き出そう。間、繰り返し、だんだん焦っても、全部OK。',
      releaseHint: '思いつくままに話そう。ここに聴衆はいない、自分の声だけ。',
      settleHint: 'ぐちゃぐちゃの思考をゆっくり整理しよう。急がない、一文ずつ。',
      quietHint: '話さなくてもいい。ここにいるだけで、静かに一瞬。',
      burnVoice1: '燻る', burnVoice2: '発火', burnVoice3: '吐露', burnVoice4: '焦燥', burnVoice5: '咆哮',
      releaseVoice1: '吐露', releaseVoice2: '愚痴', releaseVoice3: '絶叫', releaseVoice4: '嘆息', releaseVoice5: '痛快',
      settleVoice1: '整理', settleVoice2: '独語', settleVoice3: '明確化', settleVoice4: '呟き', settleVoice5: '沈静',
      quietVoice1: '呼吸', quietVoice2: '囁き', quietVoice3: '空想', quietVoice4: '沈黙', quietVoice5: 'ホワイトノイズ',
      ghost1: '思いつくままに話そう。',
      ghost2: '今日一番怒鳴りたい人、誰？',
      ghost3: '今日一番感謝したい人、また誰？',
      ghost4: '一声叫べるとしたら、何を叫ぶ？',
      ghost5: '言わないなら、今夜の夢に残しておこう。',
      ghost6: '一貫してなくていい、砕けていても大丈夫。',
      ghost7: '飲み込んだその言葉、吐き出そう。',
      ghost8: '今、体のどこが緊張してる？',
      ghost9: '空気に向かって、悔しさを吐き出そう。',
      ghost10: '二句歌ってもいい、音程外れても大丈夫。',
      ghost11: '誰にも説明する必要はない。',
      ghost12: 'ここにいるだけでいい、十秒だけでも。',
      ghost13: '一番声に出して言えないこと、何？',
      ghost14: '誰も聞いてないと思って話そう——実際誰もいないんだから。',
      ghost15: '声が震えてもいい。裏返っても大丈夫。',
      ghost16: 'ここに来たのは解放するため、演技するためじゃない。',
    },
  };

  const STORAGE_KEY = 'letout_lang';
  let current = (function () {
    try { return localStorage.getItem(STORAGE_KEY) || 'en'; } catch (e) { return 'en'; }
  })();

  function t(key, vars) {
    const dict = DICT[current] || DICT.en;
    let s = dict[key] !== undefined ? dict[key] : (DICT.en[key] !== undefined ? DICT.en[key] : key);
    if (vars) {
      Object.keys(vars).forEach((k) => { s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k])); });
    }
    return s;
  }

  function apply() {
    document.documentElement.lang = current === 'zh' ? 'zh-CN' : current === 'ja' ? 'ja' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.innerHTML = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
  }

  function setLang(lang) {
    if (!DICT[lang]) return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    apply();
    document.dispatchEvent(new CustomEvent('letout:langchange', { detail: { lang } }));
  }

  window.LOI18N = { t, setLang, getLang: () => current, apply, DICT };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
