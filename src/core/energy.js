// Распределение энергии между потребителями.
// Правило: сначала более высокий приоритет, при равенстве — раньше построенный.
// Потребитель, которому не хватило, отключается; более мелкие после него ещё могут получить питание.
export function allocateEnergy(supply, consumers) {
  const sorted = consumers
    .filter((c) => c.enabled)
    .sort((a, b) => b.priority - a.priority || a.order - b.order);
  const powered = new Set();
  let left = supply;
  for (const c of sorted) {
    if (c.demand <= left) {
      left -= c.demand;
      powered.add(c.id);
    }
  }
  const demand = consumers.filter((c) => c.enabled).reduce((s, c) => s + c.demand, 0);
  return { powered, supply, demand, used: supply - left, deficit: Math.max(0, demand - supply) };
}
