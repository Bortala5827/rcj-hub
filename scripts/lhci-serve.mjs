// 本地一键运行 Lighthouse CI：
// 1) 后台启动静态服务（端口 4200）
// 2) 运行 lhci autorun（读取 .lighthouserc.js）
// 3) 结束后清理静态服务进程（避免遗留僵尸占用端口）
import { spawn } from 'node:child_process';

const PORT = 4200;
const server = spawn('npx', ['http-server', '-p', String(PORT), '-c-1', '.'], {
  stdio: 'ignore',
  shell: true,
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await wait(3500); // 等静态服务就绪
  const lhci = spawn('npx', ['lhci', 'autorun'], { stdio: 'inherit', shell: true });
  const code = await new Promise((resolve) => {
    lhci.on('exit', (c) => resolve(c ?? 0));
    lhci.on('error', () => resolve(1));
  });
  return code;
}

main()
  .then((code) => {
    try { server.kill(); } catch { /* ignore */ }
    process.exit(code);
  })
  .catch((e) => {
    console.error(e);
    try { server.kill(); } catch { /* ignore */ }
    process.exit(1);
  });
