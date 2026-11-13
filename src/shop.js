import {
  UPGRADES, DYNAMITE, DIG_RADIUS, DIG_BASE_POWER, FUEL_MAX, FUEL_PER_LEVEL,
  CARGO_BASE, CARGO_PER_LEVEL, FORTUNE_PER_LEVEL, LASER, SHAPE_ORDER,
  ORE_VALUE, ORE_NAME,
} from './config.js';

// ---------- Estado del jugador que compra ----------
export function createStats() {
  const stash = {};
  for (const t of Object.keys(ORE_VALUE)) stash[t] = 0; // almacén de la tienda
  return {
    money: 0,
    dynamite: DYNAMITE.start,
    shape: 'circle',
    stash,
    levels: { radius: 0, power: 0, fuel: 0, bag: 0, fortune: 0, shapes: 0, laser: 0 },
  };
}

// Valores que dependen de las mejoras compradas
export const digRadius = (s) => DIG_RADIUS + 0.5 * s.levels.radius;
export const digPower = (s) => DIG_BASE_POWER + s.levels.power;
export const fuelMax = (s) => FUEL_MAX + FUEL_PER_LEVEL * s.levels.fuel;
export const bagMax = (s) => CARGO_BASE + CARGO_PER_LEVEL * s.levels.bag;
export const fortuneChance = (s) => FORTUNE_PER_LEVEL * s.levels.fortune;
export const laserPierce = (s) => (s.levels.laser > 0 ? LASER.pierce[s.levels.laser - 1] : 0);

// Formas del pico desbloqueadas, y cambio a la siguiente (tecla Q)
export const availableShapes = (s) => SHAPE_ORDER.slice(0, 1 + s.levels.shapes);
export function cycleShape(s) {
  const list = availableShapes(s);
  s.shape = list[(list.indexOf(s.shape) + 1) % list.length];
  return s.shape;
}

// ---------- Almacén: se deposita al llegar a la tienda y desde el panel se vende ----------
export const stashCount = (s) => Object.values(s.stash).reduce((a, b) => a + b, 0);
export const stashValue = (s) =>
  Object.keys(s.stash).reduce((sum, t) => sum + s.stash[t] * ORE_VALUE[t], 0);

// vende todo un mineral y devuelve lo ganado
export function sellType(s, type) {
  const earned = s.stash[type] * ORE_VALUE[type];
  s.stash[type] = 0;
  s.money += earned;
  return earned;
}

export function sellAll(s) {
  let earned = 0;
  for (const t of Object.keys(s.stash)) earned += sellType(s, t);
  return earned;
}

// ---------- Catálogo y precios ----------
export function canAfford(s, cost) {
  if (s.money < cost.money) return false;
  return Object.keys(cost.items || {}).every((t) => s.stash[t] >= cost.items[t]);
}

export function costText(s, cost) {
  const parts = [`$${cost.money}`];
  for (const t of Object.keys(cost.items || {})) parts.push(`${ORE_NAME[t]} ${s.stash[t]}/${cost.items[t]}`);
  return parts.join(', ');
}

// Lo que vende la tienda, en orden (el orden define las teclas 1, 2, 3...)
export function shopItems(s) {
  const items = Object.keys(UPGRADES).map((key) => {
    const u = UPGRADES[key];
    const lv = s.levels[key];
    const maxed = lv >= u.max;
    const desc = Array.isArray(u.desc) ? u.desc[lv] : u.desc;
    return {
      key,
      label: u.names ? u.names[Math.min(lv, u.max - 1)] : u.name,
      detail: maxed ? 'Nivel máximo' : `${desc} (nivel ${lv + 1} de ${u.max})`,
      cost: maxed ? null : u.cost[lv],
    };
  });
  items.push({
    key: 'dynamite',
    label: `Dinamita x${DYNAMITE.pack}`,
    detail: `Radio ${DYNAMITE.radius}, rompe hasta roca profunda. Tenés ${s.dynamite}`,
    cost: { money: DYNAMITE.price, items: {} },
  });
  return items;
}

// Intenta comprar: gasta dinero. Devuelve el texto, o null si no se pudo.
export function buyItem(s, key) {
  const item = shopItems(s).find((i) => i.key === key);
  if (!item || item.cost === null || !canAfford(s, item.cost)) return null;
  s.money -= item.cost.money;
  for (const t of Object.keys(item.cost.items || {})) s.stash[t] -= item.cost.items[t];
  if (key === 'dynamite') s.dynamite += DYNAMITE.pack;
  else s.levels[key]++;
  return `Compraste ${item.label}`;
}

// ---------- Panel HTML ----------
export function createShopPanel(el, stats, onAction) {
  let open = false;
  const make = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };

  function render() {
    el.replaceChildren();
    el.append(make('h2', 'Tienda'), make('p', `Dinero: $${stats.money}`, 'shop-money'));

    // almacén: tocá un mineral para venderlo o vendé todo junto
    el.append(make('h3', 'Almacén (tocá un mineral para venderlo)'));
    const chips = make('div', undefined, 'shop-chips');
    for (const t of Object.keys(stats.stash)) {
      if (stats.stash[t] === 0) continue;
      const b = make('button', `${ORE_NAME[t]} ${stats.stash[t]} ($${stats.stash[t] * ORE_VALUE[t]})`, 'chip');
      b.addEventListener('click', () => sell(t));
      chips.append(b);
    }
    if (!chips.children.length) chips.append(make('span', 'Vacío. Cavá y volvé a la tienda.', 'shop-empty'));
    el.append(chips);

    const all = make('button', `0. Vender todo (+$${stashValue(stats)})`, 'chip chip-all');
    all.disabled = stashCount(stats) === 0;
    all.addEventListener('click', () => sell(null));
    el.append(all);

    // mejoras
    el.append(make('h3', 'Mejoras'));
    shopItems(stats).forEach((item, i) => {
      const b = make('button');
      const affordable = item.cost !== null && canAfford(stats, item.cost);
      b.disabled = !affordable;

      const priceEl = make('strong', item.cost === null ? 'Máximo' : costText(stats, item.cost));
      if (item.cost !== null && !affordable) {
        priceEl.style.color = '#ff8585';
      }

      b.append(
        make('span', `${i + 1}. ${item.label}`),
        priceEl,
        make('small', item.detail),
      );
      b.addEventListener('click', () => buy(i));
      el.append(b);
    });
    el.append(make('p', 'Teclas 1 a 8 compran, 0 vende todo. E o Esc cierran.', 'shop-hint'));
  }

  function sell(type) {
    const earned = type === null ? sellAll(stats) : sellType(stats, type);
    if (earned > 0) onAction(`Vendiste${type === null ? ' todo' : ' ' + ORE_NAME[type]} por $${earned}`);
    render();
  }

  function buy(i) {
    const item = shopItems(stats)[i];
    if (!item) return;
    const text = buyItem(stats, item.key);
    if (text) onAction(text);
    render();
  }

  return {
    get isOpen() { return open; },
    open() { open = true; el.style.display = 'block'; render(); },
    close() { open = false; el.style.display = 'none'; },
    render() { if (open) render(); },
    buy(i) { if (open) buy(i); },
    sellAll() { if (open) sell(null); },
  };
}