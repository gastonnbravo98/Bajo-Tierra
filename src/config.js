export const CELL = 16;    // tamaño de cada celda en píxeles
export const CHUNK = 16;   // celdas por lado de cada chunk
export const COLS = 320;   // 20 chunks de ancho
export const ROWS = 224;   // 14 chunks de alto

// Tipos de celda
export const AIR = 0;
export const DIRT = 1;
export const STONE = 2;
export const IRON = 3;
export const GOLD = 4;
export const GRANITE = 5;
export const DIAMOND = 6;
export const BEDROCK = 7;
export const PLATFORM = 8; // plataforma indestructible bajo la tienda
export const SAND = 9;     // cae y se desparrama
export const GRAVEL = 10;  // cae derecho y se apila

// Color de cada tipo (el aire no se dibuja)
export const COLORS = {
  [DIRT]: 0x8b5a2b,
  [STONE]: 0x6b6b6b,
  [IRON]: 0xd9a066,
  [GOLD]: 0xffd700,
  [GRANITE]: 0x4a4a52,
  [DIAMOND]: 0x4fe3ff,
  [BEDROCK]: 0x15151b,
  [PLATFORM]: 0x8a9bb0,
  [SAND]: 0xe3cf8a,
  [GRAVEL]: 0x9a9486,
};

export const NAMES = {
  0: 'Aire',
  [DIRT]: 'Tierra',
  [STONE]: 'Piedra',
  [IRON]: 'Hierro',
  [GOLD]: 'Oro',
  [GRANITE]: 'Granito',
  [DIAMOND]: 'Diamante',
  [BEDROCK]: 'Roca base',
  [PLATFORM]: 'Plataforma',
  [SAND]: 'Arena',
  [GRAVEL]: 'Grava',
};

// Dureza de cada material. El pico rompe celdas con dureza <= su poder.
export const HARDNESS = {
  [DIRT]: 1,
  [STONE]: 2,
  [IRON]: 2,
  [GOLD]: 2,
  [GRANITE]: 3,
  [DIAMOND]: 3,
  [BEDROCK]: 99, // nada la rompe
  [PLATFORM]: 99,
  [SAND]: 1,
  [GRAVEL]: 1,
};
export const DIG_BASE_POWER = 2;

// Minerales: chance = probabilidad por celda de piedra de empezar una veta,
// minDepth = desde qué fracción de la altura del mapa aparece, size = largo de la veta
export const ORES = [
  { type: IRON, chance: 0.008, minDepth: 0.28, size: 5 },
  { type: GOLD, chance: 0.005, minDepth: 0.55, size: 3 },
  { type: DIAMOND, chance: 0.0015, minDepth: 0.75, size: 2 },
  // bolsas de arena y grava (fat = bolsas gordas en vez de venas finas); no se juntan ni se venden
  { type: SAND, chance: 0.0012, minDepth: 0.4, size: 40, fat: true },
  { type: GRAVEL, chance: 0.0008, minDepth: 0.5, size: 28, fat: true },
];
export const ORE_VALUE = { [IRON]: 10, [GOLD]: 50, [DIAMOND]: 200 };
export const ORE_NAME = { [IRON]: 'Hierro', [GOLD]: 'Oro', [DIAMOND]: 'Diamante' };
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
export const FUEL_PER_LEVEL = 30; // lo que suma cada mejora del tanque
export const FUEL_USE = 12;       // combustible que gasta por segundo volando
export const FUEL_REGEN = 25;     // combustible que recupera por segundo en el suelo
export const THRUST = 200;        // empuje hacia arriba (la gravedad es 110)
export const FLY_SPEED = 10;      // velocidad máxima de subida, en celdas/seg

// Mochila
export const CARGO_BASE = 30;
export const CARGO_PER_LEVEL = 20;

// Excavación
export const DIG_RADIUS = 1.5;  // radio base, en celdas (las mejoras lo agrandan)
export const DIG_REACH = 6;
export const DIG_DELAY = 0.08;

// Dinamita (click derecho): explota con un radio grande y rompe hasta granito y diamante
export const DYNAMITE = { price: 40, pack: 3, radius: 6, fuse: 1.8, start: 2, power: 3 };

// Mejoras de la tienda
export const UPGRADES = {
  radius: { name: 'Radio del pico', max: 4, cost: [100, 250, 500, 900], desc: '+0.5 de radio al cavar' },
  power: { name: 'Pico de acero', max: 1, cost: [350], desc: 'Rompe granito y diamante' },
  fuel: { name: 'Tanque de combustible', max: 4, cost: [80, 200, 400, 700], desc: '+30 de combustible' },
  bag: { name: 'Mochila grande', max: 4, cost: [60, 150, 350, 600], desc: '+20 de capacidad' },
};

// Simulación del terreno (autómata celular)
export const LOOSE = [SAND, GRAVEL];       // caen siempre que tengan aire debajo
// Derrumbes: ancho máximo (en celdas) que puede quedar sin apoyo según la dureza.
// Los materiales que no figuran acá (dureza 2 o más) nunca se derrumban.
// Si agregás `2: 8`, la piedra también cede en tramos de más de 8 celdas.
export const SPAN_BY_HARDNESS = { 1: 4 };
export const SIM_HZ = 30;                  // pasos de simulación por segundo

// Objetivo: llegar a esta profundidad (en celdas desde la superficie de la tienda)
export const GOAL_DEPTH = 150;

// Minimapa: radio que se descubre alrededor del jugador, en celdas
export const MINIMAP_RADIUS = 16;