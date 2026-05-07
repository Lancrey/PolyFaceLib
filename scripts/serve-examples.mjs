#!/usr/bin/env node
// Tiny zero-dependency static file server for the examples directory.
// Builds the lib once on startup so /dist/index.js exists, then serves the
// repo root over HTTP so the example pages can ES-module-import from /dist.
//
// Usage: `npm run examples` → http://localhost:5173/examples/

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.cjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.map':  'application/json; charset=utf-8',
};

async function build() {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`build exited ${code}`)));
  });
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const joined = normalize(join(root, decoded));
  if (!joined.startsWith(root + sep) && joined !== root) return null;
  return joined;
}

async function send(res, path) {
  try {
    const s = await stat(path);
    if (s.isDirectory()) {
      const idx = join(path, 'index.html');
      try { await stat(idx); return send(res, idx); } catch { /* fall through */ }
      res.writeHead(403); res.end('Directory listing disabled.'); return;
    }
    const body = await readFile(path);
    // Disable browser caching: rebuilds happen on every `npm run examples`
    // and we don't want the browser serving a stale dist/index.js.
    res.writeHead(200, {
      'Content-Type': MIME[extname(path)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    if (err.code === 'ENOENT') { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(500); res.end(String(err));
  }
}

console.log('[examples] building dist/ ...');
await build();

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';
  if (url === '/') { res.writeHead(302, { Location: '/examples/' }); res.end(); return; }
  const path = safeJoin(ROOT, url);
  if (!path) { res.writeHead(403); res.end('Forbidden'); return; }
  await send(res, path);
});

server.listen(PORT, () => {
  console.log(`[examples] http://localhost:${PORT}/examples/`);
});
