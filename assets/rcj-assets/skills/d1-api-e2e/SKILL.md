---
name: d1-api-e2e
description: Cloudflare Pages + D1 + 本机 DNS 劫持环境下的 API 端到端验证工具。在 Windows Git Bash 下用 curl `--connect-to` 绕过 DNS 劫持到保留 IP（198.18.0.0/15），通过双 IP 轮换+失败重试稳定验证 REST API。适用于：mianshi-dazi / 辅警 / 消防员站及任何 CF Pages + D1 项目的功能验证、bug 复现、回归测试。
---

# d1-api-e2e

CF Pages + D1 REST API 多轮端到端验证。专为**本机 DNS 劫持严重**（curl 35 / schannel handshake failed）+ **边缘节点握手不稳**环境设计。

## 核心问题
- **DNS 劫持**：`facetalk.955827.xyz` / `fj.rcj9527.dpdns.org` 等域名被 ISP 污染，解析到 RFC 5737 保留段 `198.18.0.x`，curl 报 `curl: (35) schannel: failed to receive handshake`
- **边缘节点不稳**：CF 边缘节点临时不可用，单次 curl 偶发失败
- **Windows Git Bash 缺 sleep**：bash 子进程 `sleep` 不可用
- **无 OpenSSL**：`openssl s_client` 命令缺失

## 解决套路
1. **DoH 拿真实 IP**：`curl --noproxy '*' https://cloudflare-dns.com/dns-query?name=DOMAIN&type=A -H "accept: application/dns-json"` → 取 `Answer[].data`
2. **curl --connect-to 绕劫持**：`--connect-to DOMAIN:443:REAL_IP:443`（注意 `--resolve` 在 Windows schannel curl 下不生效，**必须用 --connect-to**）
3. **双 IP 轮换**：CF 域名通常有 2 个 A 记录，依次重试
4. **失败重试 2-3 次**：每次重试间 sleep 1s
5. **Python sleep 替代 bash sleep**：`time.sleep()` 通用

## 标准模板（参考 `C:/Users/小样儿/AppData/Local/Temp/wall_e2e.py`）

```python
import subprocess, json, time

HOST = "facetalk.955827.xyz"
IPS = ["104.21.48.251", "172.67.157.25"]  # CF DoH 查到的真实 IP

def hit(method, path, body=None, params=""):
    if params: path = f"{path}?{params}"
    url = f"https://{HOST}{path}"
    for attempt in range(3):
        for ip in IPS:
            cmd = ["curl", "--noproxy", "*",
                   "--connect-to", f"{HOST}:443:{ip}:443",
                   "-sS", "-X", method, url,
                   "-H", "Cache-Control: no-cache"]
            if body is not None:
                cmd += ["-H", "content-type: application/json",
                        "-d", json.dumps(body, ensure_ascii=False)]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if r.returncode == 0 and r.stdout:
                return r.stdout
        time.sleep(1)
    return None
```

## 调试技巧
- **CF DoH 优先**（`cloudflare-dns.com/dns-query`），阿里/8.8.8.8 DoH 也常被劫持
- **不要用 `--resolve`**：Windows schannel 不生效；用 `--connect-to` 才能在 Windows 下绕过 DNS
- **判断劫持**：`curl -v https://DOMAIN 2>&1 | grep "IPv4"` 看是否落到 `198.18.0.x`
- **判断 API 端点问题**：`curl https://DOMAIN/api/xxx` 即使 IPv4 正确也可能握手失败；改走 `--connect-to` 即可
- **D1 建表成功判断**：D1 控制台"表数量"是缓存快照不自动刷新，**别看数字**，直接 curl 测 API 返 200 才算成功
- **D1 表结构验证**：`PRAGMA table_info(table_name)` 看列是否齐全（`ALTER TABLE` 不增表数）

## 典型验证流程（以留言墙为例）
1. 基线 GET → 期望空库返回 `{"ok":true,"items":[]}`
2. POST 第 1 条 → 期望 `{"ok":true,"item":{"id":...}}`
3. GET 列表 → 期望含刚发的
4. 限流测试（同 IP 立即再发）→ 期望 `RATE_LIMIT`
5. sleep 35s 让限流窗口过
6. 去重测试（同文本）→ 期望 `DUP`
7. 管理员删除 → 期望 `removed:1`
8. 最终列表 → 期望清空

## 适用项目
- mianshi-dazi（facetalk.955827.xyz）✅ 已验证留言墙
- 辅警站（fj.rcj9527.dpdns.org）
- 消防员站（xf.955827.xyz）
- rcj-hub（955827.xyz）
- 任何 CF Pages + D1 静态站

## 已知坑
- 5 分钟去重测试常被 60s 限流卡住 → 这是设计正确（限流优先），非 bug
- POST 后立刻 GET 可能因 D1 写入可见性延迟读到空 → `time.sleep(1)` 即可
- bash 子进程缺 `sleep` → 改用 Python 脚本或 `ping -n 2 127.0.0.1 >nul`
- CF Pages 偶发 500 → 等 1-2 分钟重试，不要立刻归咎代码
- bash 输出重定向到 `2>/dev/null` 后 **Python 错误不会显示** → 测试脚本里直接 `print(stderr)`
