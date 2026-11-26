import {
  UPGRADES, DYNAMITE, OUTPOST, DIG_RADIUS, DIG_BASE_POWER, FUEL_MAX, FUEL_PER_LEVEL,
  CARGO_BASE, CARGO_PER_LEVEL, FORTUNE_PER_LEVEL, LASER, COLORS,
  SHAPE_ORDER, ORE_VALUE, ORE_NAME, IS_INFINITE, IS_HARD,
} from './config.js';

const oreHex = (t) => `#${(COLORS[t] ?? 0xffffff).toString(16).padStart(6, '0')}`;

export function createStats() {
  const stash = {};
  for (const t of Object.keys(ORE_VALUE)) stash[t] = 0;
  return {
    money: 0,
    dynamite: DYNAMITE.start,
    outposts: IS_INFINITE ? OUTPOST.start : 0,
    shape: 'circle',
    stash,
    levels: {
      radius: 0, power: 0, fuel: 0, bag: 0, fortune: 0, shapes: 0, laser: 0,
      flashlight: 0, suit: 0,
    },
  };
}

export const digRadius = (s) => DIG_RADIUS + 0.5 * s.levels.radius;
export const digPower = (s) => DIG_BASE_POWER + s.levels.power;
export const fuelMax = (s) => FUEL_MAX + FUEL_PER_LEVEL * s.levels.fuel;
export const bagMax = (s) => CARGO_BASE + CARGO_PER_LEVEL * s.levels.bag;
export const fortuneChance = (s) => FORTUNE_PER_LEVEL * s.levels.fortune;
export const laserPierce = (s) => (s.levels.laser > 0 ? LASER.pierce[s.levels.laser - 1] : 0);

export const availableShapes = (s) => SHAPE_ORDER.slice(0, 1 + s.levels.shapes);
export function cycleShape(s) {
  const list = availableShapes(s);
  s.shape = list[(list.indexOf(s.shape) + 1) % list.length];
  return s.shape;
}

export const stashCount = (s) => Object.values(s.stash).reduce((a, b) => a + b, 0);
export const stashValue = (s) =>
  Object.keys(s.stash).reduce((sum, t) => sum + s.stash[t] * ORE_VALUE[t], 0);

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

export function canAfford(s, cost) {
  if (s.money < cost.money) return false;
  return Object.keys(cost.items || {}).every((t) => s.stash[t] >= cost.items[t]);
}

export function costText(s, cost) {
  const parts = [`$${cost.money}`];
  for (const t of Object.keys(cost.items || {})) parts.push(`${ORE_NAME[t]} ${s.stash[t]}/${cost.items[t]}`);
  return parts.join(', ');
}

export function shopItems(s) {
  const items = Object.keys(UPGRADES)
    .filter((key) => !UPGRADES[key].hardOnly || IS_HARD)
    .map((key) => {
      const u = UPGRADES[key];
      const lv = s.levels[key];
      const maxed = lv >= u.max;
      const desc = Array.isArray(u.desc) ? u.desc[lv] : u.desc;
      return {
        key,
        label: u.names ? u.names[Math.min(lv, u.max - 1)] : u.name,
        detail: maxed ? 'Nivel máximo' : `${desc} (nv. ${lv + 1}/${u.max})`,
        cost: maxed ? null : u.cost[lv],
      };
    });

  items.push({
    key: 'dynamite',
    label: `Dinamita x${DYNAMITE.pack}`,
    detail: `Radio ${DYNAMITE.radius}, rompe roca profunda. Tenés ${s.dynamite}`,
    cost: { money: DYNAMITE.price, items: {} },
  });
  items.push({
    key: 'outpost',
    label: 'Puesto Avanzado',
    detail: `Base subterránea con G (viajá con T). Tenés ${s.outposts}`,
    cost: { money: OUTPOST.price, items: {} },
  });
  return items;
}

export function buyItem(s, key) {
  const item = shopItems(s).find((i) => i.key === key);
  if (!item || item.cost === null || !canAfford(s, item.cost)) return null;
  s.money -= item.cost.money;
  for (const t of Object.keys(item.cost.items || {})) s.stash[t] -= item.cost.items[t];
  if (key === 'dynamite') s.dynamite += DYNAMITE.pack;
  else if (key === 'outpost') s.outposts += 1;
  else s.levels[key]++;
  return `Compraste ${item.label}`;
}

export function createShopPanel(el, stats, onAction, onTeleport, questManager = null) {
  let open = false;
  const make = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };

  function render() {
    el.replaceChildren();

    const header = make('div', undefined, 'shop-header');
    header.append(make('h2', 'Tienda'), make('p', `Dinero: $${stats.money}`, 'shop-money'));
    el.append(header);

    el.append(make('h3', 'Almacén (clic en un mineral para venderlo)'));
    const chips = make('div', undefined, 'shop-chips');
    for (const t of Object.keys(stats.stash)) {
      if (stats.stash[t] === 0) continue;
      const b = make('button', undefined, 'chip');
      const dot = make('span', undefined, 'ore-dot');
      dot.style.background = oreHex(t);
      const txt = make('span', `${ORE_NAME[t]} ${stats.stash[t]} ($${stats.stash[t] * ORE_VALUE[t]})`);
      b.append(dot, txt);
      b.addEventListener('click', () => sell(t));
      chips.append(b);
    }
    if (!chips.children.length) chips.append(make('span', 'Vacío. Cavá y volvé a la tienda.', 'shop-empty'));
    el.append(chips);

    const actions = make('div', undefined, 'shop-actions');
    const all = make('button', `0. Vender todo (+$${stashValue(stats)})`, 'chip chip-all');
    all.disabled = stashCount(stats) === 0;
    all.addEventListener('click', () => sell(null));
    actions.append(all);

    if (onTeleport) {
      const tp = make('button', 'T. Viajar a otra base', 'chip chip-all');
      tp.addEventListener('click', () => { close(); onTeleport(); });
      actions.append(tp);
    }
    el.append(actions);

    el.append(make('h3', 'Mejoras y equipamiento'));
    const grid = make('div', undefined, 'shop-grid');
    shopItems(stats).forEach((item, i) => {
      const b = make('button');
      const affordable = item.cost !== null && canAfford(stats, item.cost);
      b.disabled = !affordable;

      const priceEl = make('strong', item.cost === null ? 'Máximo' : costText(stats, item.cost));
      if (item.cost !== null && !affordable) priceEl.style.color = '#ff8585';

      b.append(
        make('span', `${i < 9 ? `${i + 1}. ` : ''}${item.label}`),
        priceEl,
        make('small', item.detail),
      );
      b.addEventListener('click', () => buy(i));
      grid.append(b);
    });
    el.append(grid);

    if (questManager) {
      el.append(make('h3', 'Contratos / Misiones'));
      const qGrid = make('div', undefined, 'shop-grid');
      for (const q of questManager.getViews(stats)) {
        const qb = make('button');
        qb.disabled = !q.ready;
        const badge = make('strong', q.ready ? `Reclamar (${q.rewardText})` : q.progressText);
        if (q.ready) badge.style.color = '#7ae582';
        qb.append(
          make('span', q.label),
          badge,
          make('small', q.ready ? 'Listo para entregar' : `Recompensa: ${q.rewardText}`),
        );
        qb.addEventListener('click', () => {
          const res = questManager.claim(q.id, stats);
          if (res) {
            onAction(`Contrato completado: +$${res.money}${res.dynamite ? ` +${res.dynamite} din.` : ''}`);
            render();
          }
        });
        qGrid.append(qb);
      }
      el.append(qGrid);
    }

    el.append(make('p', 'Teclas 1-9 compran, 0 vende todo, G instala base, T viaja. E o Esc cierran.', 'shop-hint'));
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

  function close() {
    open = false;
    el.style.display = 'none';
  }

  return {
    get isOpen() { return open; },
    open() { open = true; el.style.display = 'block'; render(); },
    close,
    render() { if (open) render(); },
    buy(i) { if (open) buy(i); },
    sellAll() { if (open) sell(null); },
  };
}