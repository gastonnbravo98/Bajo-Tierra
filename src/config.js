export const CELL = 8;   // tamaño de cada celda en píxeles
export const COLS = 100;
export const ROWS = 60;

// Tipos de celda
export const AIR = 0;
export const DIRT = 1;
export const STONE = 2;

// Color de cada tipo (el aire no se dibuja)
export const COLORS = {
  [DIRT]: 0x8b5a2b,
  [STONE]: 0x6b6b6b,
};