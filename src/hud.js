import {
  SIZES, BIOME_NAMES, SHAPE_NAMES, ORE_NAME, COLORS, CELL, IS_INFINITE, IS_HARD, VOLCANICO,
} from './config.js';
import { stashCount, stashValue, bagMax, availableShapes, laserPierce } from './shop.js';
import { findNearestBase } from './recovery.js';
import { mmss } from './debug.js';

const oreHex = (t) => `#${(COLORS[t] ?? 0xffffff).toString(16).padStart(6, '0')}`;

function dirArrow(dx, dy) {
  const ang = Math.atan2(dy, dx);
  const dirs = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  const idx = Math.round(((ang + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return dirs[idx];
}

/**
 * Crea el controlador del HUD gráfico para actualizar la interfaz solo cuando cambia el contenido.
 */
export function createHud(hudEl) {
  let lastHtml = '';

  function show() {
    hudEl.style.display = 'block';
  }

  function hide() {
    hudEl.style.display = 'none';
    lastHtml = '';
  }

  function update(state) {
    const {
      seed, sizeKey, depth, goal, won, playTime, stats, cargo, cargoTotal,
      player, biomeIdx, inBounds, bases, nearBase, nearChest,
      nearGasDist, nearLavaDist, msg, activeQuests, digHint,
    } = state;

    const bagChips = Object.keys(cargo)
      .filter((t) => cargo[t] > 0)
      .map((t) => (
        `<span class="hud-ore-chip">` +
          `<span class="ore-dot" style="background:${oreHex(t)}"></span>` +
          `${ORE_NAME[t]} <b>${cargo[t]}</b>` +
        `</span>`
      ))
      .join('');

    const maxBag = bagMax(stats);
    const bagPct = Math.max(0, Math.min(100, (cargoTotal / maxBag) * 100));
    const bagFull = cargoTotal >= maxBag;

    const fuelPct = Math.max(0, Math.min(100, (player.fuel / player.fuelMax) * 100));
    const fuelCur = Math.ceil(player.fuel);
    const fuelLow = fuelPct <= 25;
    const fuelEmpty = fuelCur <= 0;

    const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    const hpCur = Math.ceil(player.hp);

    const biome = inBounds ? BIOME_NAMES[biomeIdx] : '-';
    const isHot = IS_HARD && (biomeIdx === VOLCANICO || depth > 130);

    const depthPct = IS_INFINITE ? 0 : Math.max(0, Math.min(100, (depth / goal) * 100));
    const depthLabel = IS_INFINITE
      ? `${depth} m (Infinito)`
      : `${depth} / ${goal} m${won ? ' 🏆' : ''}`;

    let compassHtml = '';
    if (!nearBase && bagPct >= 85 && bases.length > 0) {
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      const nearest = findNearestBase(bases, px, py);
      if (nearest) {
        const distM = Math.round(Math.hypot(nearest.x - px, nearest.y - py) / CELL);
        const arrow = dirArrow(nearest.x - px, nearest.y - py);
        compassHtml = `<div class="hud-compass">🧭 ${nearest.name}: <b>${arrow} ${distM} m</b></div>`;
      }
    }

    const questLines = (activeQuests || [])
      .slice(0, 3)
      .map((q) => (
        `<div class="hud-quest${q.ready ? ' ready' : ''}">` +
          `<span>${q.ready ? '✅' : '▸'} ${q.label}</span>` +
          `<span class="hud-q-prog">${q.ready ? 'Listo' : q.progressText}</span>` +
        `</div>`
      ))
      .join('');

    const pills = [
      `<span class="hud-pill">💣 ${stats.dynamite}</span>`,
      `<span class="hud-pill">⛺ ${stats.outposts} (G)</span>`,
      bases.length > 1 ? `<span class="hud-pill">🌀 ${bases.length} (T)</span>` : '',
      availableShapes(stats).length > 1 ? `<span class="hud-pill">⛏️ ${SHAPE_NAMES[stats.shape]} (Q)</span>` : '',
      laserPierce(stats) > 0 ? `<span class="hud-pill">⚡ Láser (F)</span>` : '',
    ].filter(Boolean).join('');

    const html = [
      `<div class="hud-top">` +
        `<span class="hud-seed">#${seed} · ${SIZES[sizeKey].name}</span>` +
        `<span class="hud-badge ${IS_HARD ? 'hard' : 'easy'}">${IS_HARD ? 'Difícil' : 'Fácil'}</span>` +
      `</div>`,
      `<div class="hud-stats">` +
        `<div class="hud-stat"><span>⛰️ ${biome}${isHot ? ' 🔥' : ''}</span><span>⏱️ ${mmss(playTime)}</span></div>` +
        `<div class="hud-stat"><span>💰 <b class="hud-gold">$${stats.money}</b></span><span>📦 ${stashCount(stats)} ($${stashValue(stats)})</span></div>` +
      `</div>`,
      `<div class="bar-row">` +
        `<span class="bar-lbl">📏 Prof.</span>` +
        `<div class="bar-track"><div class="bar-fill depth" style="width:${IS_INFINITE ? 100 : depthPct.toFixed(1)}%"></div><span class="bar-val">${depthLabel}</span></div>` +
      `</div>`,
      IS_HARD ? (
        `<div class="bar-row">` +
          `<span class="bar-lbl">❤️ Vida</span>` +
          `<div class="bar-track${hpPct <= 30 ? ' empty' : ''}"><div class="bar-fill hp${hpPct <= 30 ? ' low' : ''}" style="width:${hpPct.toFixed(1)}%"></div><span class="bar-val">${hpCur}/${player.maxHp}</span></div>` +
        `</div>`
      ) : '',
      `<div class="bar-row">` +
        `<span class="bar-lbl">🔥 Fuel</span>` +
        `<div class="bar-track${fuelEmpty ? ' empty' : ''}"><div class="bar-fill fuel${fuelLow ? ' low' : ''}" style="width:${fuelPct.toFixed(1)}%"></div><span class="bar-val">${fuelEmpty ? 'VACÍO' : `${fuelCur}/${player.fuelMax}`}</span></div>` +
      `</div>`,
      `<div class="bar-row">` +
        `<span class="bar-lbl">🎒 Mochila</span>` +
        `<div class="bar-track${bagFull ? ' empty' : ''}"><div class="bar-fill bag${bagFull ? ' full' : ''}" style="width:${bagPct.toFixed(1)}%"></div><span class="bar-val">${cargoTotal}/${maxBag}</span></div>` +
      `</div>`,
      bagChips ? `<div class="hud-ores">${bagChips}</div>` : '',
      `<div class="hud-pills">${pills}</div>`,
      compassHtml,
      questLines ? `<div class="hud-section-title">Contratos</div><div class="hud-quests">${questLines}</div>` : '',
      nearBase ? `<div class="hud-prompt">🛒 Apretá <b>E</b> para abrir ${nearBase.name}</div>` : '',
      nearChest ? `<div class="hud-prompt chest">🗝️ Apretá <b>E</b> para abrir Cofre (${nearChest.tier})</div>` : '',
      digHint ? `<div class="hud-warn">${digHint}</div>` : '',
      nearGasDist <= 5 ? `<div class="hud-warn">⚠️ Sensor: Gas cercano (${Math.ceil(nearGasDist)}m)</div>` : '',
      nearLavaDist <= 5 ? `<div class="hud-warn">🔥 Sensor: Lava cercana (${Math.ceil(nearLavaDist)}m)</div>` : '',
      msg ? `<div class="${fuelEmpty || hpPct <= 30 ? 'hud-warn' : 'hud-msg'}">${msg}</div>` : '',
    ].filter(Boolean).join('');

    if (html !== lastHtml) {
      hudEl.innerHTML = html;
      lastHtml = html;
    }
  }

  return { show, hide, update };
}
