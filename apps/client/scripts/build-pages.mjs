import { build } from 'vite';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.PAGES_BASE_PATH || '/Billiards/';
if (!/^\/(?:[A-Za-z0-9_.%-]+\/)*$/.test(base)) throw new Error('PAGES_BASE_PATH must be an absolute directory path');
const outDir = resolve(process.env.PAGES_OUT_DIR || 'dist');
await build({ base, build: { outDir, emptyOutDir: true } });
await writeFile(resolve(outDir, '.nojekyll'), '');
await writeFile(resolve(outDir, '404.html'), `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>返回 3D Billiards</title>
<body style="background:#0b0d0e;color:#fff;font-family:system-ui;text-align:center;padding:15vh 20px">
<p>正在返回游戏…</p><a style="color:#d8b15f" href="${base}">进入 3D Billiards</a>
<script>location.replace(${JSON.stringify(base)} + location.search + location.hash);</script>
</body></html>
`);
