import {
  UPGRADES, DYNAMITE, DIG_RADIUS, DIG_BASE_POWER,
  FUEL_MAX, FUEL_PER_LEVEL, CARGO_BASE, CARGO_PER_LEVEL,
} from './config.js';

// ---------- Estado del jugador que compra ----------
export function createStats() {
  return {
    money: 0,
    dynamite: DYNAMITE.start,
    levels: { radius: 0, power: 0, fuel: 0, bag: 0 },
  };
}

// Valores que dependen de las mejoras compradas
export const digRadius = (s) => DIG_RADIUS + 0.5 * s.levels.radius;
export const digPower = (s) => DIG_BASE_POWER + s.levels.power;
export const fuelMax = (s) => FUEL_MAX + FUEL_PER_LEVEL * s.levels.fuel;
export const bagMax = (s) => CARGO_BASE + CARGO_PER_LEVEL * s.levels.bag;

// Lo que vende la tienda, en orden (el orden define las teclas 1, 2, 3...)
export function shopItems(s) {
  const items = Object.keys(UPGRADES).map((key) => {
    const u = UPGRADES[key];
    const lv = s.levels[key];
    const maxed = lv >= u.max;
    return {
      key,
      label: u.name,
      detail: maxed ? 'Nivel máximo' : `${u.desc} (nivel ${lv} de ${u.max})`,
      cost: maxed ? null : u.cost[lv],
    };
  });
  items.push({
    key: 'dynamite',
    label: `Dinamita x${DYNAMITE.pack}`,
    detail: `Radio ${DYNAMITE.radius}, rompe todo menos la roca base. Tenés ${s.dynamite}`,
    cost: DYNAMITE.price,
  });
  return items;
}

// Intenta comprar. Devuelve el texto de lo comprado, o null si no se pudo.
export function buyItem(s, key) {
  const item = shopItems(s).find((i) => i.key === key);
  if (!item || item.cost === null || s.money < item.cost) return null;
  s.money -= item.cost;
  if (key === 'dynamite') s.dynamite += DYNAMITE.pack;
  else s.levels[key]++;
  return `Compraste ${item.label} por $${item.cost}`;
}

// ---------- Panel HTML ----------
export function createShopPanel(el, stats, onBuy) {
  let open = false;

  function render() {
    el.replaceChildren();

    const title = document.createElement('h2');
    title.textContent = 'Tienda';
    const money = document.createElement('p');
    money.className = 'shop-money';
    money.textContent = `Dinero: $${stats.money}`;
    el.append(title, money);

    shopItems(stats).forEach((item, i) => {
      const b = document.createElement('button');
      b.disabled = item.cost === null || stats.money < item.cost;
      const name = document.createElement('span');
      name.textContent = `${i + 1}. ${item.label}`;
      const price = document.createElement('strong');
      price.textContent = item.cost === null ? 'Máximo' : `$${item.cost}`;
      const detail = document.createElement('small');
      detail.textContent = item.detail;
      b.append(name, price, detail);
      b.addEventListener('click', () => buy(i));
      el.append(b);
    });

    const hint = document.createElement('p');
    hint.className = 'shop-hint';
    hint.textContent = 'Click o teclas 1 a 5. E o Esc para cerrar.';
    el.append(hint);
  }

  function buy(i) {
    const item = shopItems(stats)[i];
    if (!item) return;
    const text = buyItem(stats, item.key);
    if (text) onBuy(text);
    render();
  }

  return {
    get isOpen() { return open; },
    open() { open = true; el.style.display = 'block'; render(); },
    close() { open = false; el.style.display = 'none'; },
    render() { if (open) render(); },
    buy(i) { if (open) buy(i); },
  };
}
