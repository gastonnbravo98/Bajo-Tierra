/**
 * Encuentra la base más cercana a la posición en píxeles (px, py).
 */
export function findNearestBase(bases, px, py) {
  if (!bases || bases.length === 0) return null;
  let best = bases[0];
  let bestDist = Infinity;
  for (const b of bases) {
    const d = Math.hypot(b.x - px, b.y - py);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

/**
 * Aplica penalización de muerte en Modo Difícil: conserva una fracción de cada mineral.
 * @returns {{ lost: number, kept: number }}
 */
export function applyDeathPenalty(cargo, keepRatio = 0.5) {
  let lost = 0;
  let kept = 0;
  for (const t in cargo) {
    const cur = cargo[t] || 0;
    if (cur <= 0) continue;
    const next = Math.floor(cur * keepRatio);
    lost += cur - next;
    kept += next;
    cargo[t] = next;
  }
  return { lost, kept };
}
