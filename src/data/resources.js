// Валюты (видны сверху) и материалы (лежат в инвентаре).
// price — цена продажи на рынке в монетах; по ней же считается цена в самоцветах.

export const CURRENCIES = {
  gold: { name: 'Монеты', color: '#ffd34d' },
  gems: { name: 'Самоцветы', color: '#ff5fd2' },
  food: { name: 'Еда', color: '#ff9a4d' },
};

export const MATERIALS = {
  wood:       { name: 'Древесина',        tier: 1, price: 1,  color: '#c98a4b', desc: 'Рубится с деревьев. Основа почти всех построек.' },
  stone:      { name: 'Камень',           tier: 1, price: 1,  color: '#a9b0bd', desc: 'Добывается из валунов киркой.' },
  bones:      { name: 'Кости',            tier: 1, price: 1,  color: '#efe3c8', desc: 'Остаются от поверженных тварей.' },
  planks:     { name: 'Доски',            tier: 1, price: 3,  color: '#e6c27a', desc: 'Лесопилка делает их из древесины.' },
  bricks:     { name: 'Каменные блоки',   tier: 2, price: 4,  color: '#9aa3b5', desc: 'Каменотёс вытёсывает их из камня.' },
  ore:        { name: 'Железная руда',    tier: 2, price: 3,  color: '#b0745a', desc: 'Жилы Ржавых холмов и шахты.' },
  coal:       { name: 'Уголь',            tier: 2, price: 3,  color: '#4a4a55', desc: 'Пласты в холмах или углежогня.' },
  iron:       { name: 'Железо',           tier: 2, price: 8,  color: '#c9ced8', desc: 'Плавильня: руда и уголь.' },
  parts:      { name: 'Механизмы',        tier: 3, price: 15, color: '#d9a64a', desc: 'Мастерская: железо и доски.' },
  crystal:    { name: 'Светокристалл',    tier: 3, price: 12, color: '#7ff3ff', desc: 'Друзы Лунных пустошей.' },
  silver:     { name: 'Лунное серебро',   tier: 3, price: 12, color: '#dfe8ff', desc: 'Жилы Лунных пустошей.' },
  essence:    { name: 'Эссенция мглы',    tier: 3, price: 10, color: '#b07aff', desc: 'Сгустки тумана из сильных тварей и разломов.' },
  mithrilOre: { name: 'Мифриловая руда',  tier: 4, price: 20, color: '#6fd6c8', desc: 'Жилы Мифриловых кряжей.' },
  mithril:    { name: 'Мифрил',           tier: 4, price: 45, color: '#9ff5e8', desc: 'Плавильня 10+ уровня: руда и уголь.' },
  starmetal:  { name: 'Звёздный металл',  tier: 5, price: 80, color: '#ffb0f0', desc: 'Обломки упавших звёзд в Кратере.' },
};

export const MATERIAL_ORDER = Object.keys(MATERIALS);

// Редкость предметов по уровню (тиру).
export const RARITY = [
  null,
  { name: 'Обычный', color: '#b8b8c0' },
  { name: 'Добротный', color: '#f2f2f2' },
  { name: 'Редкий', color: '#6ee36e' },
  { name: 'Особый', color: '#5aa8ff' },
  { name: 'Эпический', color: '#c07aff' },
  { name: 'Мифический', color: '#ff9a3c' },
  { name: 'Легендарный', color: '#ffd34d' },
];
