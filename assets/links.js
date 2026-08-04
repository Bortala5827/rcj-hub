// rcj-hub · 友链前端：渲染 + 投稿
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 1) 渲染已通过友链
  var box = document.getElementById('link-list');
  if (box) {
    fetch('/api/links')
      .then(function (r) { return r.json(); })
      .then(function (list) {
        if (!list || !list.length) {
          box.innerHTML = '<p class="muted">暂无友链，欢迎投稿或提 PR。</p>';
          return;
        }
        box.innerHTML = list.map(function (l) {
          return '<a class="link-card" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
            '<b>' + esc(l.name) + '</b>' +
            (l.desc ? '<span>' + esc(l.desc) + '</span>' : '') +
            '</a>';
        }).join('');
      })
      .catch(function () { box.innerHTML = '<p class="muted">友链加载失败。</p>'; });
  }

  // 2) 投稿表单
  var form = document.getElementById('link-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('lf-msg');
      var btn = form.querySelector('button[type="submit"]');
      var fd = new FormData(form);
      msg.textContent = '提交中…';
      msg.className = 'lf-msg';
      btn.disabled = true;
      fetch('/api/link', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) {
            msg.textContent = '已收到，筛选通过后会出现在友链区 ✅';
            msg.className = 'lf-msg ok';
            form.reset();
          } else {
            msg.textContent = '提交失败：' + (data.error || '未知错误');
            msg.className = 'lf-msg err';
          }
        })
        .catch(function () {
          msg.textContent = '网络错误，请稍后再试';
          msg.className = 'lf-msg err';
        })
        .finally(function () { btn.disabled = false; });
    });
  }
})();
