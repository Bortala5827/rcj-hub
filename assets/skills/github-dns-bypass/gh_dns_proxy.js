// 本地 CONNECT 代理：用 DoH(DNS-over-HTTPS) 解析域名，绕过被污染的 UDP/系统 DNS 劫持。
// 适用场景：本机 github.com 被 DNS 劫持（指向 198.18.x 假站）且 Clash/系统代理未运行时，完成 git push/fetch。
// 注意：UDP 53 也被劫持的网络下，旧版「裸 UDP 查 8.8.8.8:53」方案已失效，必须用 DoH（走 443 而非 53）。
// node gh_dns_proxy.js  ->  默认监听 127.0.0.1:10809（可用 PROXY_PORT 环境变量覆盖，如 PROXY_PORT=8787）
//
// v2 多 IP 容错：resolve 返回全部 A 记录，CONNECT 时逐个尝试建立隧道，某 IP 被限（CONNECT aborted）
// 自动换下一个，避免单 IP 抖动导致整次 push 失败。
const http = require('http');
const net = require('net');
const https = require('https');

const PORT = Number(process.env.PROXY_PORT || 10809);
const cache = {}; // 域名 -> IP 数组缓存，避免每次 CONNECT 都发 DoH 请求（git 有多次连接，缓存显著提速）

// DoH 解析器：多节点回落，覆盖各出口对某 DoH IP 的 443 被限的情况
const DOH = [
  { host: '1.1.1.1', path: h => `/dns-query?name=${encodeURIComponent(h)}&type=A`, accept: 'application/dns-json' },
  { host: '8.8.8.8', path: h => `/resolve?name=${encodeURIComponent(h)}&type=A`, accept: 'application/dns-json' },
  { host: '208.67.222.222', path: h => `/dns-query?name=${encodeURIComponent(h)}&type=A`, accept: 'application/dns-json' }, // OpenDNS 备用
];

function dohLookup(host) {
  return new Promise((resolve_, reject) => {
    let tried = 0;
    const attempt = () => {
      if (tried >= DOH.length) return reject(new Error('DoH 全部失败: ' + host));
      const s = DOH[tried++];
      const req = https.request(
        { host: s.host, port: 443, path: s.path(host), method: 'GET', headers: { accept: s.accept }, timeout: 8000 },
        res => {
          let d = ''; res.on('data', c => (d += c));
          res.on('end', () => {
            try {
              const j = JSON.parse(d);
              const ans = (j.Answer || j.answer || []).filter(x => x.type === 1).map(x => x.data);
              if (ans.length) resolve_(ans);
              else attempt();
            } catch (e) { attempt(); }
          });
        }
      );
      req.on('error', attempt);
      req.on('timeout', () => { req.destroy(); attempt(); });
      req.end();
    };
    attempt();
  });
}

async function resolveAll(host) {
  if (cache[host]) return cache[host];
  let ips;
  try {
    ips = await dohLookup(host);
  } catch (e) {
    // DoH 三节点全挂（本机 UDP/DoH 出口抖动）→ 回落
    console.error('DoH 失败, 回落:', host, e.message);
    ips = FALLBACK[host] || (await systemLookup(host));
  }
  cache[host] = ips;
  return ips;
}

// 已知可达的 GitHub IP（DoH 全挂时的兜底，覆盖 140.82.x / 20.205.x / 13.250.x 多个段）
const FALLBACK = {
  'github.com': [
    '20.205.243.166', '140.82.113.4', '140.82.121.3', '13.250.177.223',
    '140.82.112.4', '140.82.114.4', '140.82.121.4', '20.205.243.164',
  ],
  'api.github.com': ['20.205.243.166', '140.82.113.4', '140.82.121.3'],
  'objects.githubusercontent.com': ['185.199.108.133', '185.199.109.133', '185.199.110.133', '185.199.111.133'],
  'codeload.github.com': ['20.205.243.166', '140.82.113.4', '140.82.121.3'],
};

// 系统解析兜底（仅当无硬编码兜底时）：注意本机 DNS 被劫持到 198.18.x，通常不可用，但留作最后手段
function systemLookup(host) {
  return new Promise(resolve => {
    require('dns').lookup(host, { all: true }, (err, addrs) => {
      if (!err && addrs.length) resolve(addrs.map(a => a.address));
      else resolve([]);
    });
  });
}

// 尝试用某个 IP 建立隧道；成功返回 true（隧道已 pipe，后续由 pipe 维持），失败返回 false
function tryConnect(host, port, ip, cltSocket, head) {
  return new Promise(resolve => {
    let done = false;
    const fail = () => { if (!done) { done = true; resolve(false); } };
    const srvSocket = net.connect(port, ip);
    const to = setTimeout(() => { try { srvSocket.destroy(); } catch (e) {} fail(); }, 6000);
    srvSocket.on('connect', () => {
      if (done) return;
      done = true; clearTimeout(to);
      try { cltSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); } catch (e) {}
      if (head && head.length) srvSocket.write(head);
      cltSocket.pipe(srvSocket);
      srvSocket.pipe(cltSocket);
      resolve(true);
    });
    srvSocket.on('error', fail);
    srvSocket.on('close', fail);
  });
}

const server = http.createServer();
server.on('connect', async (req, cltSocket, head) => {
  const [host, portStr] = req.url.split(':');
  const port = Number(portStr) || 443;
  cltSocket.on('error', () => {}); // 吞掉客户端断连错误（如 curl 提前断开），避免崩掉整个 server
  let ips;
  try { ips = await resolveAll(host); }
  catch (e) { cltSocket.end(); console.error('解析失败', host, e.message); return; }
  if (!ips.length) { cltSocket.end(); return; }
  for (const ip of ips) {
    const ok = await tryConnect(host, port, ip, cltSocket, head);
    if (ok) return; // 隧道已建立，直接返回（pipe 维持连接）
  }
  // 全部 IP 都连不上：清缓存下次重新解析，并关闭客户端
  delete cache[host];
  try { cltSocket.destroy(); } catch (e) {}
  console.error('全部 IP 连接失败', host, ips.join(','));
});
server.on('error', e => console.error('server error', e.message));
server.listen(PORT, '127.0.0.1', () => console.log('DoH CONNECT proxy (multi-IP fallback) listening on 127.0.0.1:' + PORT));
