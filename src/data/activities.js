// Активности на карте: сундуки, святилища, разломы мглы, записки смотрителей, бродячий торговец.

export const CHESTS = {
  max: 3,
  spawnEvery: 80,            // секунд, пока идёт строительство (не во время волны)
  // добыча зависит от самой дальней открытой зоны
  loot: {
    gold: [15, 1.6],          // база и множитель за номер зоны (×зона^мн.)
    gemChance: 0.08,
    materials: {
      1: ['wood', 'stone', 'planks', 'bones'],
      2: ['bricks', 'ore', 'coal', 'iron'],
      3: ['crystal', 'silver', 'essence', 'parts'],
      4: ['mithrilOre', 'mithril', 'essence'],
      5: ['starmetal', 'mithril', 'essence'],
    },
  },
};

export const SHRINES = {
  perZone: 2,
  cooldown: 180,
  duration: 60,
  buffs: [
    { id: 'might', name: 'Благословение силы', desc: 'Урон героя +50%', stats: { damage: 0.5 } },
    { id: 'swift', name: 'Благословение ветра', desc: 'Скорость и атака +30%', stats: { speed: 0.3, attackSpeed: 0.3 } },
    { id: 'life', name: 'Благословение жизни', desc: 'Сильное восстановление здоровья', stats: { regen: 12 } },
    { id: 'gold', name: 'Благословение удачи', desc: 'Монеты с тварей ×2', stats: { goldFind: 1 } },
  ],
};

export const RIFTS = {
  spawnEvery: 120,
  max: 1,
  hp: 80,
  hpPerZone: 1.8,
  guards: 3,
  guardTypes: ['skeleton', 'hound', 'brute', 'archer', 'shieldbearer', 'wraith'],
  loot: { essence: [3, 1.6], gold: [25, 1.7] },
};

export const MERCHANT = {
  everyWaves: 5,
  offers: 4,
  pool: [
    { give: { wood: 120 }, price: 90 },
    { give: { stone: 120 }, price: 90 },
    { give: { planks: 60 }, price: 140 },
    { give: { bricks: 50 }, price: 160, zone: 2 },
    { give: { iron: 30 }, price: 220, zone: 2 },
    { give: { coal: 40 }, price: 110, zone: 2 },
    { give: { parts: 12 }, price: 230, zone: 3 },
    { give: { crystal: 20 }, price: 240, zone: 3 },
    { give: { silver: 20 }, price: 240, zone: 3 },
    { give: { essence: 25 }, price: 260, zone: 3 },
    { give: { mithril: 10 }, price: 480, zone: 4 },
    { give: { starmetal: 5 }, price: 600, zone: 5 },
    { give: { food: 120 }, price: 100 },
    { give: { gems: 5 }, price: 700 },
  ],
};

// Записки — разбросаны по карте, открываются вместе с землёй. Подбираются касанием.
export const NOTES = [
  { id: 'note1', zone: 1, title: 'Записка смотрителя: день первый', text: 'Маяк Велесграда погас на рассвете. Мы зажгли запасной огонь в Сердце — его хватит, пока кто-то о нём заботится.' },
  { id: 'note2', zone: 1, title: 'Детский рисунок', text: 'На обрывке бумаги — дом, солнце и человек в синем капюшоне. Подпись: «Хранитель придёт».' },
  { id: 'note3', zone: 2, title: 'Журнал рудокопа', text: 'В Ржавых холмах руда пела. Потом пришла мгла, и песня сменилась скрежетом. Мы ушли, оставив кирки в забоях.' },
  { id: 'note4', zone: 2, title: 'Приказ капитана', text: 'Стражам маяков: держать ворота до последнего. Если падёт свет — не возвращаться домой. Мгла помнит лица.' },
  { id: 'note5', zone: 3, title: 'Лунная песнь', text: 'Серебро пустошей впитывает лунный свет. Кузнецы говорили: клинок из него режет даже туман.' },
  { id: 'note6', zone: 3, title: 'Письмо без адреса', text: 'Если читаешь это — значит, свет снова дошёл до пустошей. Значит, всё было не зря.' },
  { id: 'note7', zone: 4, title: 'Чертёж мифрилового маяка', text: 'Мифрил не тускнеет во мгле. Последний маяк строили из него — и он стоит до сих пор, где-то у Кратера.' },
  { id: 'note8', zone: 4, title: 'Исповедь Лича', text: 'Я был смотрителем. Я хотел удержать свет вечно — и отдал за это жизнь. Теперь я храню лишь тьму.' },
  { id: 'note9', zone: 5, title: 'Звёздный камень', text: 'Звезда упала, и из её осколков рождалась мгла. Но в каждом осколке горит и искра света.' },
  { id: 'note10', zone: 5, title: 'Последняя страница', text: 'Когда Сердце обнимет весь край, мгла отступит к самому небу. Но не исчезнет — она будет ждать, пока свет снова ослабнет.' },
];
