export const CELL = 16;    // tamaño de cada celda en píxeles
export const COLS = 200;
export const ROWS = 120;

// Tipos de celda
export const AIR = 0;
export const DIRT = 1;
export const STONE = 2;

// Color de cada tipo (el aire no se dibuja)
export const COLORS = {
  [DIRT]: 0x8b5a2b,
  [STONE]: 0x6b6b6b,
};

// Jugador (tamaños en celdas, velocidades en celdas/seg)
export const PLAYER_W = 0.8;
export const PLAYER_H = 1.8;
export const MOVE_SPEED = 10;
export const GRAVITY = 110;
export const JUMP_SPEED = 26;  // salta ~3 celdas de alto
export const MAX_FALL = 40;    // velocidad máxima de caída