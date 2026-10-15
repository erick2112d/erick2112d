// Обёртка над Yandex Games SDK: загрузка, разметка геймплея, реклама, покупки, облачные сохранения, рекорды.
// Вне Яндекса работает заглушка: сохранения в localStorage, реклама за награду имитируется,
// покупки недоступны (для проверки — параметр ?testpay в адресе).
const LOCAL_KEY = 'lastlight.save.v2';
const LEADERBOARD = 'waves';

export async function initPlatform() {
  const sdk = await loadYandexSdk();
  let ysdk = null;
  let player = null;
  let payments = null;
  if (sdk) {
    try {
      ysdk = await sdk.init();
      player = await ysdk.getPlayer({ scopes: false }).catch(() => null);
      payments = await ysdk.getPayments({ signed: false }).catch(() => null);
    } catch (e) {
      console.warn('Yandex SDK init failed', e);
      ysdk = null;
    }
  }
  const p = new Platform(ysdk, player, payments);
  await p.loadCatalog();
  return p;
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
  constructor(ysdk, player, payments) {
    this.ysdk = ysdk;
    this.player = player;
    this.payments = payments;
    this.isYandex = !!ysdk;
    this.gameplayOn = false;
    this.catalog = {};
    this.testPay = new URLSearchParams(location.search).has('testpay');
    this.lang = ysdk?.environment?.i18n?.lang || 'ru';
  }

  ready() {
    try { this.ysdk?.features?.LoadingAPI?.ready(); } catch { /* нет API */ }
  }

  setGameplay(on) {
    if (on === this.gameplayOn) return;
    this.gameplayOn = on;
    try {
      const api = this.ysdk?.features?.GameplayAPI;
      if (api) on ? api.start() : api.stop();
    } catch { /* нет API */ }
  }

  // ---------- сохранения ----------

  async load() {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch { local = null; }
    let cloud = null;
    if (this.player) {
      try { cloud = (await this.player.getData(['save']))?.save || null; } catch { cloud = null; }
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

  // ---------- реклама ----------

  showFullscreenAd({ onOpen, onClose }) {
    if (!this.ysdk) { onClose?.(); return; }
    this.ysdk.adv.showFullscreenAdv({ callbacks: { onOpen: () => onOpen?.(), onClose: () => onClose?.(), onError: () => onClose?.() } });
  }

  showRewardedAd({ onOpen, onRewarded, onClose }) {
    if (!this.ysdk) {
      onOpen?.();
      const el = document.createElement('div');
      el.className = 'fake-ad';
      el.textContent = 'Здесь будет реклама Яндекса (тест)';
      document.body.appendChild(el);
      setTimeout(() => { el.remove(); onRewarded?.(); onClose?.(); }, 1200);
      return;
    }
    this.ysdk.adv.showRewardedVideo({
      callbacks: { onOpen: () => onOpen?.(), onRewarded: () => onRewarded?.(), onClose: () => onClose?.(), onError: () => onClose?.() },
    });
  }

  // ---------- покупки ----------

  paymentsReady() { return !!this.payments || this.testPay; }

  async loadCatalog() {
    if (!this.payments) return;
    try {
      const list = await this.payments.getCatalog();
      for (const p of list) this.catalog[p.id] = p.price || `${p.priceValue} ${p.priceCurrencyCode}`;
    } catch { /* каталог не настроен */ }
  }

  price(id) { return this.catalog[id] || null; }

  // onGrant(productId) вызывается после оплаты; затем покупка подтверждается (consume).
  async purchase(id, onGrant) {
    if (this.testPay && !this.payments) { onGrant(id); return true; }
    if (!this.payments) return false;
    try {
      const p = await this.payments.purchase({ id });
      onGrant(id);
      await this.payments.consumePurchase(p.purchaseToken).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  // Покупки, оплаченные, но не выданные (например, закрыли вкладку).
  async restorePurchases(onGrant) {
    if (!this.payments) return;
    try {
      const list = await this.payments.getPurchases();
      for (const p of list) {
        onGrant(p.productID);
        await this.payments.consumePurchase(p.purchaseToken).catch(() => {});
      }
    } catch { /* нет покупок */ }
  }

  // ---------- рекорды ----------

  async submitScore(value) {
    try {
      if (this.ysdk?.leaderboards?.setScore) await this.ysdk.leaderboards.setScore(LEADERBOARD, value);
      else if (this.ysdk?.getLeaderboards) (await this.ysdk.getLeaderboards()).setLeaderboardScore(LEADERBOARD, value);
    } catch { /* таблица не настроена */ }
  }
}
