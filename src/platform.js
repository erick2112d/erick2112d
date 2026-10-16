// Обёртка над Yandex Games SDK: загрузка, разметка геймплея, реклама, покупки, облачные сохранения, рекорды.
// Вне Яндекса работает заглушка: сохранения в localStorage, реклама за награду имитируется,
// покупки недоступны (для проверки — параметр ?testpay в адресе).
// В Android-приложении (RuStore) покупки идут через платежи RuStore — мост window.LLAndroid.pay*.
import { PRODUCTS } from './data/index.js';
const LOCAL_KEY = 'lastlight.save.v2';
const LEADERBOARD = 'waves';
const GRANTED_KEY = 'lastlight.granted.v1'; // выданные покупки RuStore — чтобы не выдать одну дважды

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
  // в приложении цены RuStore подгружаются фоном — загрузку игры из-за сети не задерживаем
  if (p.app) p.loadCatalog(); else await p.loadCatalog();
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
    // Android-приложение (RuStore): игра открыта в WebView из файлов приложения
    this.isApp = !!window.LLAndroid || location.hostname === 'appassets.androidplatform.net';
    this.lang = ysdk?.environment?.i18n?.lang || 'ru';
    // платежи RuStore: есть, если сборка знает ID приложения в консоли RuStore
    this.app = null;
    try { if (window.LLAndroid?.payConfigured?.()) this.app = window.LLAndroid; } catch { this.app = null; }
    this.appPay = false;
    this.flush = null; // сохранить игру сразу после выдачи покупки (задаёт main.js)
    this.waiters = {};
    if (this.app) {
      window.__LL_pay = {
        ready: (d) => this.resolve('ready', d),
        result: (d) => this.resolve('result', d),
        pending: (d) => this.resolve('pending', d),
      };
    }
  }

  // ---------- мост к Android ----------

  wait(name, call, ms) {
    return new Promise((ok) => {
      const timer = setTimeout(() => { delete this.waiters[name]; ok(null); }, ms);
      this.waiters[name] = (d) => { clearTimeout(timer); ok(d); };
      try { call(); } catch { clearTimeout(timer); delete this.waiters[name]; ok(null); }
    });
  }

  resolve(name, d) {
    const w = this.waiters[name];
    delete this.waiters[name];
    w?.(d);
  }

  granted() {
    try { return JSON.parse(localStorage.getItem(GRANTED_KEY) || '[]'); } catch { return []; }
  }

  // Выдать товар ровно один раз, сохранить игру и только потом подтвердить оплату в RuStore.
  grantOnce(productId, purchaseId, onGrant) {
    const list = this.granted();
    if (!list.includes(purchaseId)) {
      onGrant(productId);
      list.push(purchaseId);
      try { localStorage.setItem(GRANTED_KEY, JSON.stringify(list.slice(-200))); } catch { /* нет хранилища */ }
      try { this.flush?.(); } catch { /* сохранение не удалось — товар уже в игре */ }
    }
    try { this.app.payConfirm(purchaseId); } catch { /* подтвердится при следующем запуске */ }
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

  // Реклама есть на Яндекс Играх; в браузере для проверки — заглушка; в приложении пока нет.
  adsAvailable() { return this.isYandex || !this.isApp; }

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

  paymentsReady() { return !!this.payments || this.testPay || this.appPay; }

  async loadCatalog() {
    if (this.app) {
      const d = await this.wait('ready', () => this.app.payInit(PRODUCTS.map((p) => p.id).join(',')), 8000);
      if (d?.ok) {
        Object.assign(this.catalog, d.prices || {});
        this.appPay = Object.keys(this.catalog).length > 0;
      } else if (d) console.warn('Платежи RuStore недоступны:', d.reason);
      return;
    }
    if (!this.payments) return;
    try {
      const list = await this.payments.getCatalog();
      for (const p of list) this.catalog[p.id] = p.price || `${p.priceValue} ${p.priceCurrencyCode}`;
    } catch { /* каталог не настроен */ }
  }

  price(id) { return this.catalog[id] || null; }

  // onGrant(productId) вызывается после оплаты; затем покупка подтверждается (consume).
  async purchase(id, onGrant) {
    if (this.appPay) {
      const r = await this.wait('result', () => this.app.payBuy(id), 15 * 60 * 1000);
      if (!r?.ok || !r.purchaseId) return false;
      this.grantOnce(r.productId || id, r.purchaseId, onGrant);
      return true;
    }
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
    if (this.app) {
      const d = await this.wait('pending', () => this.app.payRestore(), 15000);
      for (const p of d?.list || []) this.grantOnce(p.productId, p.purchaseId, onGrant);
      return;
    }
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
