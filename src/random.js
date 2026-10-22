// Generador pseudoaleatorio con seed: misma seed, misma secuencia
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convierte lo que escribió el jugador en un número de seed.
// Vacío -> aleatoria. Solo dígitos -> ese número. Cualquier otro texto -> hash (FNV-1a).
export function seedFromText(text) {
  const t = text.trim();
  if (t === '') return Math.floor(Math.random() * 1e9); // acá sí vale Math.random: solo elige la seed
  if (/^\d{1,9}$/.test(t)) return Number(t);
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}