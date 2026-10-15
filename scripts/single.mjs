// Однофайловая версия игры (весь код и стили внутри одного HTML): dist/last-light.html
// node scripts/single.mjs [--fragment] [путь]  — --fragment: без doctype/html/head/body (для встраивания в оболочку)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = args.find((a) => !a.startsWith('--')) || join(root, 'dist', 'last-light.html');
mkdirSync(dirname(out), { recursive: true });
const tmp = join(root, 'dist', '.bundle.js');
execFileSync('npx', ['--yes', 'esbuild@0.23.1', 'src/main.js', '--bundle', '--format=esm', '--minify', '--target=es2020', `--outfile=${tmp}`], { cwd: root, stdio: 'inherit' });
const js = readFileSync(tmp, 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(root, 'style.css'), 'utf8');
const body = `<div id="app">
  <canvas id="game"></canvas>
  <div id="hud"></div>
  <div id="loader">Разжигаем Сердце Светоча…</div>
</div>
<script type="module">${js}</script>`;
const head = `<title>Последний Светоч</title>
<meta name="description" content="Защити последний источник света от тварей из тумана.">
<style>:root{color-scheme:dark}${css}</style>`;
const html = fragment
  ? `${head}\n${body}\n`
  : `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
writeFileSync(out, html);
console.log('Готово:', out, `${Math.round(html.length / 1024)} КБ`);
