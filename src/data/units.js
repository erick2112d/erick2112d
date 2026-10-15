// Союзные юниты.
export const UNITS = {
  hero: { name: 'Хранитель', hp: 120, speed: 4.2, radius: 0.3 },
  swordsman: { name: 'Мечник', hp: 70, speed: 3.2, radius: 0.28, damage: 9, cooldown: 0.9, range: 0.9, aggro: 5, leash: 7 },
  archer: { name: 'Лучник', hp: 45, speed: 3, radius: 0.27, damage: 8, cooldown: 1.1, range: 5, aggro: 6.5, leash: 8, ranged: true, projectileSpeed: 14 },
  mage: { name: 'Боевой маг', hp: 60, speed: 2.8, radius: 0.28, damage: 18, cooldown: 1.8, range: 5, aggro: 6.5, leash: 8, ranged: true, projectileSpeed: 9, splash: 1.3 },
  worker: { name: 'Рабочий', hp: 40, speed: 2.8, radius: 0.24 },
  repairer: { name: 'Ремонтник', hp: 40, speed: 3, radius: 0.24 },
};
