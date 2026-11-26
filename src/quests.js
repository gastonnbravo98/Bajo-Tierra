import {
  IRON, COPPER, SILVER, GOLD, CRYSTAL, RUBY, EMERALD, DIAMOND, ORE_NAME, ORE_VALUE,
} from './config.js';
import { mulberry32 } from './random.js';

const MINERAL_POOL = [
  [IRON, 8, 14],
  [COPPER, 6, 12],
  [SILVER, 5, 9],
  [GOLD, 4, 8],
  [CRYSTAL, 3, 6],
  [RUBY, 2, 5],
  [EMERALD, 2, 4],
  [DIAMOND, 2, 4],
];

/**
 * Administra contratos / misiones secundarias procedurales.
 */
export function createQuestManager(seed) {
  const rand = mulberry32(seed + 4242);
  let nextId = 1;
  let tier = 0;
  const counters = {
    depth: 0,
    chests: 0,
    enemies: 0,
    dynamite: 0,
  };

  function makeQuest() {
    tier++;
    const roll = rand();
    if (roll < 0.5) {
      const maxIdx = Math.min(MINERAL_POOL.length - 1, 1 + Math.floor(tier / 2));
      const [ore, minQ, maxQ] = MINERAL_POOL[Math.floor(rand() * (maxIdx + 1))];
      const target = minQ + Math.floor(rand() * (maxQ - minQ + 1));
      const money = Math.round(target * ORE_VALUE[ore] * 1.75);
      return {
        id: nextId++,
        kind: 'mineral',
        ore,
        target,
        label: `Entregá ${target} de ${ORE_NAME[ore]}`,
        reward: { money, dynamite: rand() < 0.35 ? 1 : 0 },
      };
    }

    if (roll < 0.68) {
      const target = Math.max(30, Math.round((counters.depth + 30 + tier * 15) / 10) * 10);
      return {
        id: nextId++,
        kind: 'depth',
        target,
        label: `Alcanzá ${target} m de profundidad`,
        reward: { money: 90 + tier * 40, dynamite: 1 },
      };
    }

    if (roll < 0.84) {
      const target = counters.enemies + 2 + Math.floor(tier / 3);
      return {
        id: nextId++,
        kind: 'enemies',
        target,
        label: `Derrotá ${target - counters.enemies} criaturas`,
        base: counters.enemies,
        reward: { money: 110 + tier * 35, dynamite: 1 },
      };
    }

    if (roll < 0.94) {
      const target = counters.chests + 1;
      return {
        id: nextId++,
        kind: 'chests',
        target,
        label: 'Abrí 1 cofre subterráneo',
        base: counters.chests,
        reward: { money: 130 + tier * 30, dynamite: 0 },
      };
    }

    const target = counters.dynamite + 2;
    return {
      id: nextId++,
      kind: 'dynamite',
      target,
      label: 'Detoná 2 dinamitas',
      base: counters.dynamite,
      reward: { money: 85 + tier * 20, dynamite: 2 },
    };
  }

  const active = [makeQuest(), makeQuest(), makeQuest()];

  function record(kind, value = 1) {
    if (kind === 'depth') {
      if (value > counters.depth) counters.depth = value;
    } else if (kind in counters) {
      counters[kind] += value;
    }
  }

  function progressOf(q, stats) {
    if (q.kind === 'mineral') return stats.stash[q.ore] || 0;
    if (q.kind === 'depth') return counters.depth;
    return counters[q.kind] || 0;
  }

  function getViews(stats) {
    return active.map((q) => {
      const cur = progressOf(q, stats);
      const base = q.base || 0;
      const shownCur = Math.min(q.target - base, Math.max(0, cur - base));
      const shownTarget = q.target - base;
      const ready = cur >= q.target;
      const rewardParts = [`+$${q.reward.money}`];
      if (q.reward.dynamite > 0) rewardParts.push(`+${q.reward.dynamite} din.`);
      return {
        id: q.id,
        kind: q.kind,
        label: q.label,
        progressText: `${shownCur}/${shownTarget}`,
        ready,
        rewardText: rewardParts.join(' '),
      };
    });
  }

  function claim(id, stats) {
    const idx = active.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    const q = active[idx];
    if (progressOf(q, stats) < q.target) return null;

    if (q.kind === 'mineral') {
      stats.stash[q.ore] -= q.target;
    }
    stats.money += q.reward.money;
    stats.dynamite += q.reward.dynamite;

    active[idx] = makeQuest();
    return {
      label: q.label,
      money: q.reward.money,
      dynamite: q.reward.dynamite,
    };
  }

  return {
    record,
    getViews,
    claim,
    get counters() { return { ...counters }; },
  };
}
