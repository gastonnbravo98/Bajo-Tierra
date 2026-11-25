export const CELL = 16;    // tamaño de cada celda en píxeles
export const CHUNK = 16;   // celdas por lado de cada chunk

// Tamaños de mundo. 'infinite' genera chunks on-demand sin límites en X ni hacia abajo.
export const SIZES = {
  small:    { name: 'Pequeño',  cols: 192, rows: 128, oreBoost: 1.6, infinite: false },
  medium:   { name: 'Mediano',  cols: 320, rows: 224, oreBoost: 1,   infinite: false },
  large:    { name: 'Grande',   cols: 480, rows: 320, oreBoost: 1,   infinite: false },
  infinite: { name: 'Infinito', cols: 320, rows: 224, oreBoost: 1.15, infinite: true },
};

export let COLS = SIZES.medium.cols;
export let ROWS = SIZES.medium.rows;
export let CHUNKS_X = COLS / CHUNK;
export let CHUNKS_Y = ROWS / CHUNK;
export let ORE_BOOST = SIZES.medium.oreBoost;
export let IS_INFINITE = false;

export function setWorldSize(key) {
  const s = SIZES[key] || SIZES.medium;
  COLS = s.cols;
  ROWS = s.rows;
  CHUNKS_X = COLS / CHUNK;
  CHUNKS_Y = ROWS / CHUNK;
  ORE_BOOST = s.oreBoost;
  IS_INFINITE = Boolean(s.infinite);
}

// meta: en modo infinito es el primer hito (250 m), luego podés seguir bajando sin fin
export const goalDepth = () => (IS_INFINITE ? 250 : Math.round(ROWS * 0.67));

// Tipos de celda
export const AIR = 0;
export const DIRT = 1;
export const STONE = 2;
export const IRON = 3;
export const GOLD = 4;
export const GRANITE = 5;
export const DIAMOND = 6;
export const BEDROCK = 7;
export const PLATFORM = 8;   // plataforma indestructible bajo la tienda
export const SAND = 9;       // cae y se desparrama
export const GRAVEL = 10;    // cae derecho y se apila
export const DEEPROCK = 11;  // roca profunda
export const OBSIDIAN = 12;
export const MAGMA_ROCK = 13;
export const COPPER = 14;
export const SILVER = 15;
export const CRYSTAL = 16;   // cristal de energía
export const RUBY = 17;
export const EMERALD = 18;

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
  [DEEPROCK]: 0x3a3c4d,
  [OBSIDIAN]: 0x2b2140,
  [MAGMA_ROCK]: 0x8a2e1c,
  [COPPER]: 0xd2693c,
  [SILVER]: 0xdfe6ee,
  [CRYSTAL]: 0xb967ff,
  [RUBY]: 0xe0245e,
  [EMERALD]: 0x2ecc71,
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
  [DEEPROCK]: 'Roca profunda',
  [OBSIDIAN]: 'Obsidiana',
  [MAGMA_ROCK]: 'Roca de magma',
  [COPPER]: 'Cobre',
  [SILVER]: 'Plata',
  [CRYSTAL]: 'Cristal',
  [RUBY]: 'Rubí',
  [EMERALD]: 'Esmeralda',
};

export const HARDNESS = {
  [DIRT]: 1,
  [SAND]: 1,
  [GRAVEL]: 1,
  [STONE]: 2,
  [IRON]: 2,
  [COPPER]: 2,
  [SILVER]: 2,
  [GOLD]: 2,
  [GRANITE]: 3,
  [DEEPROCK]: 3,
  [DIAMOND]: 3,
  [CRYSTAL]: 3,
  [RUBY]: 3,
  [EMERALD]: 3,
  [OBSIDIAN]: 4,
  [MAGMA_ROCK]: 5,
  [BEDROCK]: 99,
  [PLATFORM]: 99,
};
export const DIG_BASE_POWER = 2;

export const LAYERS = { deep: 0.5, magma: 0.78 };

export const NORMAL = 0;
export const ARENOSO = 1;
export const VOLCANICO = 2;
export const CRISTALINO = 3;
export const BIOME_NAMES = ['Normal', 'Arenoso', 'Volcánico', 'Cristalino'];
export const BIOME_TINT = [
  [1, 1, 1],
  [1.12, 1.04, 0.8],
  [1.2, 0.85, 0.8],
  [0.82, 0.95, 1.2],
];
export const TINTABLE = [DIRT, STONE, GRANITE, DEEPROCK, MAGMA_ROCK, SAND, GRAVEL];

export const ORES = [
  { type: IRON, chance: 0.008, minDepth: 0.28, maxDepth: 0.7, size: 5, biome: { [ARENOSO]: 0.7 } },
  { type: COPPER, chance: 0.006, minDepth: 0.3, maxDepth: 0.7, size: 4 },
  { type: SILVER, chance: 0.004, minDepth: 0.42, maxDepth: 0.9, size: 3, biome: { [CRISTALINO]: 2 } },
  { type: GOLD, chance: 0.005, minDepth: 0.55, maxDepth: 0.95, size: 3 },
  { type: CRYSTAL, chance: 0.0014, minDepth: 0.5, maxDepth: 0.97, size: 3, biome: { [CRISTALINO]: 6, [VOLCANICO]: 0 } },
  { type: RUBY, chance: 0.0009, minDepth: 0.58, maxDepth: 0.97, size: 2, biome: { [VOLCANICO]: 3 } },
  { type: EMERALD, chance: 0.0008, minDepth: 0.62, maxDepth: 0.97, size: 2, biome: { [CRISTALINO]: 2 } },
  { type: DIAMOND, chance: 0.0012, minDepth: 0.62, maxDepth: 0.98, size: 2 },
  { type: OBSIDIAN, chance: 0.0014, minDepth: 0.5, maxDepth: 0.98, size: 7, fat: true, biome: { [VOLCANICO]: 4 } },
  { type: SAND, chance: 0.0012, minDepth: 0.4, maxDepth: 0.75, size: 40, fat: true, biome: { [ARENOSO]: 6, [VOLCANICO]: 0 } },
  { type: GRAVEL, chance: 0.0008, minDepth: 0.5, maxDepth: 0.8, size: 28, fat: true, biome: { [ARENOSO]: 3 } },
];
export const ORE_VALUE = {
  [IRON]: 10, [COPPER]: 15, [SILVER]: 30, [GOLD]: 50, [CRYSTAL]: 70,
  [RUBY]: 100, [EMERALD]: 130, [DIAMOND]: 200, [OBSIDIAN]: 60,
};
export const ORE_NAME = {
  [IRON]: 'Hierro', [COPPER]: 'Cobre', [SILVER]: 'Plata', [GOLD]: 'Oro', [CRYSTAL]: 'Cristal',
  [RUBY]: 'Rubí', [EMERALD]: 'Esmeralda', [DIAMOND]: 'Diamante', [OBSIDIAN]: 'Obsidiana',
};
export const CRYSTAL_FUEL = 15;
export const SELL_RANGE = 5;

export const PLAYER_W = 0.8;
export const PLAYER_H = 1.8;
export const PLAYER_COLOR = 0x3fa9ff;
export const MOVE_SPEED = 10;
export const GRAVITY = 110;
export const JUMP_SPEED = 26;
export const MAX_FALL = 40;

export const FUEL_MAX = 100;
export const FUEL_PER_LEVEL = 30;
export const FUEL_USE = 12;
export const FUEL_REGEN = 25;
export const THRUST = 200;
export const FLY_SPEED = 10;

export const CARGO_BASE = 30;
export const CARGO_PER_LEVEL = 20;

export const DIG_RADIUS = 1.5;
export const DIG_REACH = 6;
export const DIG_DELAY = 0.08;
export const FORTUNE_PER_LEVEL = 0.15;

export const DYNAMITE = { price: 40, pack: 3, radius: 6, fuse: 1.8, start: 2, power: 3 };
export const OUTPOST = { price: 500, start: 1 }; // Puesto avanzado subterráneo (tecla G)

export const LASER = { fuel: 15, cooldown: 0.5, range: 40, pierce: [12, 20, 30] };

export const SHAPE_ORDER = ['circle', 'cross', 'drill', 'cone'];
export const SHAPE_NAMES = { circle: 'Círculo', cross: 'Cruz', drill: 'Taladro', cone: 'Cono' };

const c = (money) => ({ money, items: {} });
export const UPGRADES = {
  radius: {
    name: 'Radio del pico', max: 4, desc: '+0.5 de radio al cavar',
    cost: [c(100), c(250), c(500), c(900)],
  },
  power: {
    name: 'Pico', max: 3,
    names: ['Pico de acero', 'Pico de diamante', 'Pico de obsidiana'],
    desc: ['Rompe granito y roca profunda', 'Rompe obsidiana', 'Rompe roca de magma'],
    cost: [c(350), c(1200), c(3000)],
  },
  fuel: {
    name: 'Tanque de combustible', max: 4, desc: '+30 de combustible',
    cost: [c(80), c(200), c(400), c(700)],
  },
  bag: {
    name: 'Mochila grande', max: 4, desc: '+20 de capacidad',
    cost: [c(60), c(150), c(350), c(600)],
  },
  fortune: {
    name: 'Fortuna', max: 4, desc: '+15% de chance de doble mineral',
    cost: [c(300), c(600), c(1000), c(1800)],
  },
  shapes: {
    name: 'Formas del pico', max: 3,
    desc: ['Cruz (tecla Q para cambiar)', 'Taladro vertical', 'Cono hacia el cursor'],
    cost: [c(250), c(600), c(1500)],
  },
  laser: {
    name: 'Láser', max: 3,
    desc: ['Rayo con tecla F, gasta combustible (rompe 12 celdas)', 'Rompe 20 celdas', 'Rompe 30 celdas'],
    cost: [c(900), c(1600), c(2800)],
  },
};

export const LOOSE = [SAND, GRAVEL];
export const SPAN_BY_HARDNESS = { 1: 4 };
export const SIM_HZ = 30;
export const MINIMAP_RADIUS = 16;