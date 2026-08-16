---
name: github-dns-bypass
summary: 当本机 github.com 被 DNS 劫持（指向 198.18.x 假站）且 Clash/代理未运行时，用本地 DoH 代理绕过劫持完成 git push/fetch。
agent_created: true
---

# GitHub DNS 劫持绕过推送（DoH 版）

## 何时用
- `git push`/`git fetch` 报 `Failed to connect`、`TLS connect error`、`Connection reset`，或直连 github.com 返回假站（解析到 `198.18.x.x` / `remote_ip` 是 `198.18.x.x`）。
- 本机找不到可用出口代理（Clash/系统代理没在跑、端口无监听）。
- 浏览器能正常开 GitHub（说明 443 真实出口通，仅是 DNS 被污染）。

## 重要：UDP-DNS 旧方案已失效
本机若 **连裸 UDP 查 8.8.8.8:53 都返回假 IP**（即 UDP 53 也被劫持），旧版 `gh_dns_proxy.js`（裸 UDP DNS）就废了。
本版改用 **DoH（DNS-over-HTTPS，走 443 查 1.1.1.1/8.8.8.8/OpenDNS）** 拿真 IP，绕过被污染的 UDP 53。
**前提**：能连上 DoH 节点的 443（1.1.1.1/8.8.8.8/208.67.222.222）。绝大多数网络满足；若这些 443 也被 TCP 阻断，则需真代理/VPN。

## 诊断步骤
1. `curl -sS --max-time 8 -o /dev/null -w "%{remote_ip}\n" https://github.com` → 若 remote_ip 是 `198.18.x.x` 说明被劫持。
2. `netstat -ano | grep -E ":10808|:7890|:10809"` 看是否有代理在监听；无监听说明没可用代理。
3. 验证 DoH 可达（脚本核心）：`node -e "require('https').get({host:'1.1.1.1',path:'/dns-query?name=github.com&type=A',headers:{accept:'application/dns-json'}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(JSON.parse(d).Answer.find(x=>x.type===1).data))}).on('error',e=>console.log('FAIL',e.message))}"` → 能打印出真实 IP 即 DoH 通路正常。

## 解法：本地 DoH CONNECT 代理
把随附的 `gh_dns_proxy.js` 跑在空闲端口（默认 10809）。它对每个 CONNECT 请求用 **DoH 查 1.1.1.1（失败回落 8.8.8.8 / OpenDNS）** 拿真实 IP 再 TCP 转发，绕过系统 DNS 劫持。带 5 分钟 DNS 缓存，git 多次连接显著提速。

启动（用托管版 Node）：
```bash
# 默认端口 10809
node "/c/Users/小样儿/.workbuddy/skills/github-dns-bypass/gh_dns_proxy.js"
# 或自定义端口
PROXY_PORT=8787 node "/c/Users/小样儿/.workbuddy/skills/github-dns-bypass/gh_dns_proxy.js"
```
推送（后台启动代理后，另开一个终端执行）：
```bash
# 在仓库目录内
git -c http.proxy=http://127.0.0.1:10809 -c https.proxy=http://127.0.0.1:10809 -c http.version=HTTP/1.1 push origin main
```
fetch / clone 同理，把 `push` 换成对应子命令即可。

## 关键坑（已踩过）
1. **DoH 走 443 不是 53**：若你的网络连 1.1.1.1/8.8.8.8 的 443 也被限，脚本会自动回落 OpenDNS；仍失败就只能是真代理/VPN 环境，此技能不适用。
2. **代理 socket 必须加 `socket.on('error', ()=>{})`**：否则客户端（如 curl 提前断开）抛 `ECONNABORTED` 会崩掉整个 server，导致后续 git 连不上。target 也加 error/close handler。
3. **curl 经代理探活 `-o /dev/null` 会报 `write error` 假错**：HTTP 200 即代表隧道成功，别被误导（见下方验证）。
4. **GitHub 默认 remote 多为 SSH（`git@github.com`）**：SSH 不经 http.proxy，需先把 remote 临时改 https，push 完再恢复；或用 `GIT_SSH_COMMAND` 指定走代理（更复杂）。HTTPS remote 最省事。
5. **push 完务必停代理**：端口一直监听可能干扰其他联网程序。

## 清理
推送完成后停掉代理：
- 查 PID：`netstat -ano | grep 10809`（Windows 用 `findstr 10809`）
- 杀进程：`taskkill /F /PID <PID>` 或 PowerShell `Stop-Process -Id <PID> -Force`
- 确认释放：`netstat -ano | grep 10809`（无输出即已停）

## 验证（代理启动后，另开终端）
```bash
# 经代理探 github —— 出现 200 即隧道成功（忽略 write error 假错）
curl -sS -o /dev/null -w "github.com -> %{http_code} remote_ip=%{remote_ip}\n" \
  --connect-timeout 10 --proxy http://127.0.0.1:10809 https://github.com
```
