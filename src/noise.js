// Perlin Noise 1D: valores que cambian suavemente de una columna a la siguiente
export function makeNoise1D(rand) {
  // una "pendiente" aleatoria en cada punto entero
  const grad = [];
  for (let i = 0; i < 256; i++) grad.push(rand() * 2 - 1);

  // curva de suavizado
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  return function (x) {
    const x0 = Math.floor(x);
    const t = x - x0;
    const d0 = grad[x0 & 255] * t;             // influencia del punto izquierdo
    const d1 = grad[(x0 + 1) & 255] * (t - 1); // influencia del punto derecho
    return d0 + (d1 - d0) * fade(t);           // aprox. -0.5 a 0.5
  };
}

// Perlin Noise 2D: lo usan los biomas. Devuelve valores de aprox. -0.7 a 0.7
export function makeNoise2D(rand) {
  const N = 256;
  const gx = [];
  const gy = [];
  for (let i = 0; i < N; i++) {
    const a = rand() * Math.PI * 2; // una dirección al azar en cada punto de la grilla
    gx.push(Math.cos(a));
    gy.push(Math.sin(a));
  }
  const perm = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  // influencia del punto (ix, iy) de la grilla sobre (x, y)
  const dot = (ix, iy, x, y) => {
    const h = perm[(perm[ix & 255] + iy) & 255];
    return gx[h] * (x - ix) + gy[h] * (y - iy);
  };

  return function (x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const u = fade(x - x0);
    const v = fade(y - y0);
    return lerp(
      lerp(dot(x0, y0, x, y), dot(x0 + 1, y0, x, y), u),
      lerp(dot(x0, y0 + 1, x, y), dot(x0 + 1, y0 + 1, x, y), u),
      v
    );
  };
}