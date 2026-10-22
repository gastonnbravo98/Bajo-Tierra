export const CELL = 16;    // tamaño de cada celda en píxeles
export const CHUNK = 16;   // celdas por lado de cada chunk
export const COLS = 192;   // 12 chunks de ancho
export const ROWS = 128;   // 8 chunks de alto

// Tipos de celda
export const AIR = 0;
export const DIRT = 1;
export const STONE = 2;
export const IRON = 3;
export const GOLD = 4;
export const GRANITE = 5;

// Color de cada tipo (el aire no se dibuja)
export const COLORS = {
  [DIRT]: 0x8b5a2b,
  [STONE]: 0x6b6b6b,
  [IRON]: 0xd9a066,
  [GOLD]: 0xffd700,
  [GRANITE]: 0x4a4a52,
};

// Minerales: chance = probabilidad por celda de piedra de empezar una veta,
// minDepth = desde qué fracción de la altura del mapa aparece, size = largo de la veta
export const ORES = [
  { type: IRON, chance: 0.010, minDepth: 0.30, size: 5 },
  { type: GOLD, chance: 0.006, minDepth: 0.60, size: 3 },
];
export const ORE_VALUE = { [IRON]: 10, [GOLD]: 50 };
export const ORE_NAME = { [IRON]: 'Hierro', [GOLD]: 'Oro' };
export const SELL_RANGE = 5;   // distancia a la tienda para vender, en celdas

// Jugador (tamaños en celdas, velocidades en celdas/seg)
export const PLAYER_W = 0.8;
export const PLAYER_H = 1.8;
export const PLAYER_COLOR = 0x3fa9ff;
export const MOVE_SPEED = 10;
export const GRAVITY = 110;
export const JUMP_SPEED = 26;
export const MAX_FALL = 40;

// Jetpack
export const FUEL_MAX = 100;
export const FUEL_USE = 12;     // combustible que gasta por segundo volando
export const FUEL_REGEN = 25;   // combustible que recupera por segundo en el suelo
export const THRUST = 200;      // empuje hacia arriba (gravedad es 110)
export const FLY_SPEED = 10;    // velocidad máxima de subida, en celdas/seg

// Excavación
export const DIG_RADIUS = 2;
export const DIG_REACH = 6;
export const DIG_DELAY = 0.08;

// Minimapa: radio que se descubre alrededor del jugador, en celdas
export const MINIMAP_RADIUS = 14;