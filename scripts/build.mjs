// Сборка архива для загрузки в консоль Яндекс Игр: dist/last-light.zip
// В архиве index.html в корне, стили, код и ассеты. Внешних зависимостей нет.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const stage = join(dist, 'game');
rmSync(dist, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const f of ['index.html', 'style.css', 'src', 'assets']) {
  if (existsSync(join(root, f))) cpSync(join(root, f), join(stage, f), { recursive: true });
}
execFileSync('zip', ['-rq', '-X', '../last-light.zip', '.', '-x', '*.DS_Store', '*/.gitkeep'], { cwd: stage });
console.log('Готово: dist/last-light.zip');
