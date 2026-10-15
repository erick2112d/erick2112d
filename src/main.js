// Точка входа: собирает симуляцию, отрисовку, интерфейс, ввод, звук и платформу.
import { Game } from './core/game.js';
import { Renderer } from './render/renderer.js';
import { Hud } from './ui/hud.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { initPlatform } from './platform.js';
import { WORLD, BUILDINGS } from './data/index.js';

const STEP = 1 / 60;

async function boot() {
  const canvas = document.getElementById('game');
  const platform = await initPlatform();
  const audio = new Audio();

  let saved = null;
  try { saved = await platform.load(); } catch { saved = null; }
  let game;
  try { game = new Game(saved); } catch (e) {
    console.warn('Сохранение не загружено, новая игра', e);
    game = new Game();
  }

  const renderer = new Renderer(canvas, game);
  let speed = 1;
  let paused = false;
  let adOpen = false;
  let saveTimer = 0;
  let saveRequested = false;
  let wavesSinceAd = 0;

  const save = () => { platform.save(game.serialize()); saveRequested = false; };

  const hud = new Hud(document.getElementById('hud'), game, renderer, {
    startWave: () => { audio.unlock(); if (game.startWave()) audio.setTension(true); },
    rewarded: (onReward) => {
      platform.showRewardedAd({
        onOpen: () => { adOpen = true; audio.suspend('ad'); },
        onRewarded: onReward,
        onClose: () => { adOpen = false; audio.resume('ad'); },
      });
    },
    afterResult: () => {
      // полноэкранная реклама не чаще раза в две волны и только между волнами
      wavesSinceAd++;
      if (platform.isYandex && wavesSinceAd >= 2) {
        wavesSinceAd = 0;
        platform.showFullscreenAd({
          onOpen: () => { adOpen = true; audio.suspend('ad'); },
          onClose: () => { adOpen = false; audio.resume('ad'); },
        });
      }
    },
    buyProduct: (id, done) => {
      adOpen = true;
      audio.suspend('ad');
      platform.purchase(id, (pid) => game.grantProduct(pid)).finally(() => { adOpen = false; audio.resume('ad'); save(); done?.(); });
    },
    paymentsReady: () => platform.paymentsReady(),
    productPrice: (id) => platform.price(id),
    newGame: () => {
      platform.clear();
      game = new Game();
      game.drainEvents();
      renderer.setGame(game);
      hud.setGame(game);
      hud.showStory('intro');
      save();
    },
    toggleSound: () => { audio.unlock(); audio.toggle(); },
    soundOn: () => audio.on,
    click: () => { audio.unlock(); audio.play('click'); },
    sfx: (name) => audio.play(name),
    modalChanged: () => {},
  });
  const input = new Input(canvas, hud, renderer, () => game);
  window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
  window.addEventListener('keydown', () => audio.unlock(), { capture: true });
  window.addEventListener('resize', () => renderer.resize());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { paused = true; audio.suspend('hidden'); save(); } else { paused = false; audio.resume('hidden'); }
  });
  window.addEventListener('pagehide', save);

  // покупки, которые оплатили, но не успели выдать
  platform.restorePurchases((pid) => game.grantProduct(pid));

  game.drainEvents();
  for (const id of [...game.story.unread]) hud.showStory(id);

  // Отладка и автотесты.
  window.__LL = {
    get game() { return game; }, renderer, hud, input, BUILDINGS, WORLD,
    setSpeed: (v) => { speed = v; }, save, load: () => platform.load(),
  };

  let last = performance.now();
  let acc = 0;
  let readySent = false;
  let bestSent = game.stats.bestWave;
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const frozen = paused || adOpen || !!hud.modal || !!hud.window;
    platform.setGameplay(!frozen);
    if (!frozen) {
      const mv = input.movement();
      game.hero.input.x = mv.x;
      game.hero.input.y = mv.y;
      if (input.mouse && !game.settings.auto && !game.hero.attackAt) {
        const w = renderer.toWorld(input.mouse.x, input.mouse.y);
        const dx = w.x - game.hero.x;
        const dy = w.y - game.hero.y;
        const d = Math.hypot(dx, dy) || 1;
        game.hero.aimX = dx / d;
        game.hero.aimY = dy / d;
      }
      acc += dt * speed;
      let steps = 0;
      while (acc >= STEP && steps < 240) {
        game.update(STEP);
        acc -= STEP;
        steps++;
      }
      const events = game.drainEvents();
      renderer.consume(events, audio);
      hud.consume(events);
      if (events.some((e) => e.type === 'save')) saveRequested = true;
      if (events.some((e) => e.type === 'victory' || e.type === 'defeat')) audio.setTension(false);
      if (game.stats.bestWave > bestSent) { bestSent = game.stats.bestWave; platform.submitScore(bestSent); }
      saveTimer += dt;
      if (saveRequested && saveTimer > 1) { saveTimer = 0; save(); }
      if (saveTimer > WORLD.autoSaveSeconds) { saveTimer = 0; save(); }
    } else {
      acc = 0;
      hud.consume([]);
    }
    renderer.frame(dt, hud);
    hud.update(dt);
    if (!readySent) { readySent = true; platform.ready(); document.getElementById('loader')?.remove(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loader');
  if (l) l.textContent = 'Ошибка запуска: ' + e.message;
});
