// Обёртка над Yandex Games SDK. Вне Яндекса работает заглушка: сохранения в localStorage,
// реклама за награду имитируется коротким окном.
const LOCAL_KEY = 'lastlight.save.v1';

export async function initPlatform() {
  const sdk = await loadYandexSdk();
  let ysdk = null;
  let player = null;
  if (sdk) {
    try {
      ysdk = await sdk.init();
      player = await ysdk.getPlayer({ scopes: false }).catch(() => null);
    } catch (e) {
      console.warn('Yandex SDK init failed', e);
      ysdk = null;
    }
  }
  return new Platform(ysdk, player);
}

function loadYandexSdk() {
  return new Promise((resolve) => {
    if (window.YaGames) return resolve(window.YaGames);
    const params = new URLSearchParams(location.search);
    const onYandex = /yandex|playhop/.test(location.hostname) || params.has('yandex');
    if (!onYandex) return resolve(null);
    const s = document.createElement('script');
    s.src = '/sdk.js';
    s.async = true;
    const timer = setTimeout(() => resolve(null), 5000);
    s.onload = () => { clearTimeout(timer); resolve(window.YaGames || null); };
    s.onerror = () => { clearTimeout(timer); resolve(null); };
    document.head.appendChild(s);
  });
}

class Platform {
  constructor(ysdk, player) {
    this.ysdk = ysdk;
    this.player = player;
    this.isYandex = !!ysdk;
    this.gameplayOn = false;
    this.lang = ysdk?.environment?.i18n?.lang || 'ru';
  }

  ready() {
    try { this.ysdk?.features?.LoadingAPI?.ready(); } catch { /* нет API */ }
  }

  // Разметка игрового процесса для Яндекса (пауза/игра).
  setGameplay(on) {
    if (on === this.gameplayOn) return;
    this.gameplayOn = on;
    try {
      const api = this.ysdk?.features?.GameplayAPI;
      if (api) on ? api.start() : api.stop();
    } catch { /* нет API */ }
  }

  async load() {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch { local = null; }
    let cloud = null;
    if (this.player) {
      try {
        const d = await this.player.getData(['save']);
        cloud = d?.save || null;
      } catch { cloud = null; }
    }
    if (local && cloud) return (cloud.savedAt || 0) > (local.savedAt || 0) ? cloud : local;
    return cloud || local;
  }

  save(data) {
    const payload = { ...data, savedAt: Date.now() };
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(payload)); } catch { /* нет хранилища */ }
    if (this.player) this.player.setData({ save: payload }, false).catch(() => {});
  }

  clear() {
    try { localStorage.removeItem(LOCAL_KEY); } catch { /* нет хранилища */ }
    if (this.player) this.player.setData({ save: null }, true).catch(() => {});
  }

  showFullscreenAd({ onOpen, onClose }) {
    if (!this.ysdk) { onClose?.(); return; }
    this.ysdk.adv.showFullscreenAdv({
      callbacks: {
        onOpen: () => onOpen?.(),
        onClose: () => onClose?.(),
        onError: () => onClose?.(),
      },
    });
  }

  showRewardedAd({ onOpen, onRewarded, onClose }) {
    if (!this.ysdk) {
      // заглушка для локальной проверки
      onOpen?.();
      const el = document.createElement('div');
      el.className = 'fake-ad';
      el.textContent = 'Здесь будет реклама Яндекса (тест)';
      document.body.appendChild(el);
      setTimeout(() => { el.remove(); onRewarded?.(); onClose?.(); }, 1200);
      return;
    }
    this.ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen: () => onOpen?.(),
        onRewarded: () => onRewarded?.(),
        onClose: () => onClose?.(),
        onError: () => onClose?.(),
      },
    });
  }
}
