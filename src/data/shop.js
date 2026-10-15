// Магазин. Покупки за деньги идут только через платежи Яндекс Игр:
// id товаров нужно завести в консоли разработчика (раздел «Покупки») — см. README.
export const PRODUCTS = [
  { id: 'gems_small', name: 'Горсть самоцветов', gems: 100, fallbackPrice: '19 ян' },
  { id: 'gems_medium', name: 'Мешочек самоцветов', gems: 550, bonus: '+10%', fallbackPrice: '99 ян' },
  { id: 'gems_large', name: 'Сундук самоцветов', gems: 1200, bonus: '+20%', fallbackPrice: '199 ян' },
  { id: 'starter_pack', name: 'Набор основателя', gems: 300, gold: 2000, item: 'swordFounder', once: true, fallbackPrice: '79 ян',
    desc: '300 самоцветов, 2000 монет и «Клинок Основателя»' },
];

// Покупки за самоцветы.
export const GEM_OFFERS = [
  { id: 'crateBasic', name: 'Ящик стройматериалов', price: 20, give: { wood: 200, stone: 150, planks: 80 } },
  { id: 'crateFood', name: 'Обоз с едой', price: 15, give: { food: 200 } },
  { id: 'crateGold', name: 'Мешок монет', price: 25, give: { gold: 500 } },
  { id: 'crateMetal', name: 'Ящик металлов', price: 45, give: { bricks: 80, iron: 60, coal: 60 }, zone: 2 },
  { id: 'crateMoon', name: 'Ларец пустошей', price: 70, give: { crystal: 40, silver: 40, essence: 30 }, zone: 3 },
  { id: 'crateMithril', name: 'Мифриловый ларец', price: 120, give: { mithril: 30, mithrilOre: 40 }, zone: 4 },
  { id: 'crateStar', name: 'Звёздный обломок', price: 180, give: { starmetal: 25 }, zone: 5 },
];

export const AD_GEMS = { amount: 5, cooldown: 300 };
