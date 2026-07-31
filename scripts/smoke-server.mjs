import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 4317;
const child = spawn(process.execPath, ['scripts/dev-server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

try {
  await delay(450);
  const checks = [
    ['/', 'Football Director'],
    ['/src/styles.css', '.app-shell'],
    ['/src/mobile-game-v2.css', '.fd2-shell'],
    ['/src/main.js', "await import('./ui/controller.js')"],
    ['/src/ui/render-v2.js', 'renderDashboardV2'],
    ['/src/game/game-engine.js', 'createNewGame'],
    ['/assets/favicon.svg', '<svg']
  ];
  for (const [pathname, expected] of checks) {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
    if (!response.ok) throw new Error(`${pathname} returned ${response.status}`);
    const text = await response.text();
    if (!text.includes(expected)) throw new Error(`${pathname} did not include ${expected}`);
  }
  console.log(`Smoke check passed: ${checks.length} routes served successfully.`);
} finally {
  child.kill('SIGTERM');
}
