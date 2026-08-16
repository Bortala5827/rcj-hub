/**
 * Lighthouse CI 本地/CI 启动器
 * 自起 http-server 于 4200，等稳定后跑 lhci autorun，结束自动 kill 服务，
 * 避免失败遗留僵尸进程占用端口。
 */
import { spawn } from 'node:child_process';

const PORT = 4200;
const server = spawn(
  'npx',
  ['http-server', '-p', String(PORT), '-c-1', '.'],
  { stdio: 'inherit', shell: true },
);

const cleanup = () => {
  try { server.kill(); } catch {}
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

setTimeout(async () => {
  try {
    const { execSync } = await import('node:child_process');
    execSync('npx lhci autorun', { stdio: 'inherit' });
  } catch (e) {
    console.error('Lighthouse CI 运行出错：', e?.message || e);
  } finally {
    cleanup();
  }
}, 3500);
