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