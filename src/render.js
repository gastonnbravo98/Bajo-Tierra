import { CELL, COLS, ROWS, AIR, PLAYER_COLOR, DYNAMITE } from './config.js';

const PICK_TIERS = [
  { color: 0x8d99ae, width: 2.4 }, // 0: Pico base
  { color: 0xf1faee, width: 2.6 }, // 1: Pico de acero
  { color: 0x4fe3ff, width: 2.8 }, // 2: Pico de diamante
  { color: 0xb967ff, width: 3.2 }, // 3: Pico de obsidiana
];

export function createPlayerSprite(p) {
  const root = new PIXI.Container();

  // Contenedor centrado en X para poder espejar (scale.x = -1) sin salir de la hitbox
  const rig = new PIXI.Container();
  rig.position.set(p.w / 2, 0);
  root.addChild(rig);

  const w = p.w;
  const h = p.h;

  // 1. Jetpack en la espalda (lado izquierdo cuando mira a la derecha)
  const jetpack = new PIXI.Graphics();
  rig.addChild(jetpack);

  // Llama del jetpack integrada a la mochila
  const flame = new PIXI.Graphics();
  flame.poly([
    -w * 0.58, h * 0.66,
    -w * 0.32, h * 0.66,
    -w * 0.45, h * 0.96,
  ]).fill(0xff9f1c);
  flame.poly([
    -w * 0.52, h * 0.66,
    -w * 0.38, h * 0.66,
    -w * 0.45, h * 0.84,
  ]).fill(0xffe066);
  flame.visible = false;
  rig.addChild(flame);

  // 2. Piernas articuladas (pivote en la cadera para rotar al caminar)
  const makeLeg = (color) => {
    const leg = new PIXI.Graphics();
    leg.roundRect(-w * 0.16, 0, w * 0.32, h * 0.31, 1.5).fill(color);
    leg.rect(-w * 0.16, h * 0.24, w * 0.36, h * 0.07).fill(0x2b2118); // bota
    leg.position.set(0, h * 0.68);
    return leg;
  };
  const backLeg = makeLeg(0x1d4e89);
  const frontLeg = makeLeg(0x276fbf);
  rig.addChild(backLeg, frontLeg);

  // 3. Torso (overol de minero)
  const torso = new PIXI.Graphics();
  torso.roundRect(-w * 0.36, h * 0.34, w * 0.72, h * 0.36, 2).fill(PLAYER_COLOR);
  torso.rect(-w * 0.36, h * 0.58, w * 0.72, h * 0.07).fill(0x3d2a1a); // cinturón
  torso.rect(w * 0.05, h * 0.57, w * 0.16, h * 0.09).fill(0xffcf5a);  // hebilla
  rig.addChild(torso);

  // 4. Cabeza y casco con linterna
  const head = new PIXI.Graphics();
  head.roundRect(-w * 0.32, h * 0.12, w * 0.64, h * 0.24, 2).fill(0xf1c27d); // cara
  head.rect(w * 0.12, h * 0.19, w * 0.11, h * 0.07).fill(0x1b1b1b);          // ojo
  head.roundRect(-w * 0.38, h * 0.02, w * 0.76, h * 0.14, 3).fill(0xffcf5a); // casco
  head.rect(-w * 0.2, h * 0.12, w * 0.66, h * 0.05).fill(0xe6b43c);          // visera
  head.rect(w * 0.26, h * 0.05, w * 0.16, h * 0.08).fill(0x333333);          // cuerpo linterna
  head.rect(w * 0.38, h * 0.06, w * 0.06, h * 0.06).fill(0xffffff);          // foco
  rig.addChild(head);

  // 5. Brazo con pico (pivote en el hombro)
  const arm = new PIXI.Container();
  arm.position.set(0, h * 0.4);

  const sleeve = new PIXI.Graphics();
  sleeve.roundRect(-w * 0.12, -w * 0.1, w * 0.48, w * 0.22, 2).fill(0xf1c27d);

  const pickHandle = new PIXI.Graphics();
  pickHandle.rect(w * 0.28, -h * 0.22, 2, h * 0.34).fill(0x8b5a2b);

  const pickHead = new PIXI.Graphics();

  arm.addChild(sleeve, pickHandle, pickHead);
  rig.addChild(arm);

  function redrawEquipment(powerLv, fuelLv) {
    const tier = PICK_TIERS[Math.min(powerLv, PICK_TIERS.length - 1)];
    pickHead.clear();
    pickHead.arc(w * 0.29, -h * 0.18, w * 0.38, -Math.PI * 0.85, -Math.PI * 0.15)
      .stroke({ width: tier.width, color: tier.color });
    if (powerLv >= 2) {
      pickHead.arc(w * 0.29, -h * 0.18, w * 0.38, -Math.PI * 0.65, -Math.PI * 0.35)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.85 });
    }

    const tankW = w * (0.34 + fuelLv * 0.03);
    jetpack.clear();
    jetpack.roundRect(-w * 0.28 - tankW, h * 0.32, tankW, h * 0.34, 2).fill(0x5c677d);
    jetpack.rect(-w * 0.28 - tankW + 1, h * 0.37, tankW - 2, h * 0.07)
      .fill(fuelLv >= 3 ? 0x4fe3ff : 0xffcf5a);
  }

  redrawEquipment(0, 0);

  root.anim = {
    rig, flame, backLeg, frontLeg, arm,
    walkPhase: 0, swing: 0,
    lastPower: 0, lastFuel: 0,
    redrawEquipment,
  };

  root.getNozzlePos = () => ({
    x: root.x + w / 2 - w * 0.45 * rig.scale.x,
    y: root.y + h * 0.68,
  });

  return root;
}

export function updatePlayerSprite(sprite, p, targetWorldX, digging, levels, dt) {
  const a = sprite.anim;
  sprite.position.set(p.x, p.y);

  const powerLv = levels?.power ?? 0;
  const fuelLv = levels?.fuel ?? 0;
  if (powerLv !== a.lastPower || fuelLv !== a.lastFuel) {
    a.lastPower = powerLv;
    a.lastFuel = fuelLv;
    a.redrawEquipment(powerLv, fuelLv);
  }

  const centerX = p.x + p.w / 2;
  if (digging) {
    a.rig.scale.x = targetWorldX >= centerX ? 1 : -1;
  } else if (Math.abs(p.vx) > 1) {
    a.rig.scale.x = p.vx > 0 ? 1 : -1;
  }

  a.flame.visible = p.flying;
  if (p.flying) a.flame.scale.y = 0.85 + Math.random() * 0.35;

  if (p.onGround && Math.abs(p.vx) > 1) {
    a.walkPhase += dt * 14;
    const angle = Math.sin(a.walkPhase) * 0.65;
    a.frontLeg.rotation = angle;
    a.backLeg.rotation = -angle;
  } else if (!p.onGround) {
    a.walkPhase = 0;
    a.frontLeg.rotation = -0.35;
    a.backLeg.rotation = 0.3;
  } else {
    a.walkPhase = 0;
    a.frontLeg.rotation = 0;
    a.backLeg.rotation = 0;
  }

  if (digging) {
    a.swing += dt * 24;
    a.arm.rotation = Math.sin(a.swing) * 0.85;
  } else {
    a.swing = 0;
    a.arm.rotation = -a.frontLeg.rotation * 0.5;
  }
}

export function createBackground(world) {
  const g = new PIXI.Graphics();
  const colors = [0x3d2a1a, 0x33231a, 0x2a1d18, 0x211719, 0x19121a, 0x120d14];
  const bands = colors.length;

  if (world.infinite) {
    let lastSig = '';
    g.updateInfinite = (camX, camY, screenW, screenH, startRow) => {
      const x0 = Math.floor(camX / CELL) - 2;
      const x1 = Math.ceil((camX + screenW) / CELL) + 2;
      const y0 = Math.max(0, Math.floor(camY / CELL) - 2);
      const y1 = Math.ceil((camY + screenH) / CELL) + 2;
      const sig = `${x0},${x1},${y0},${y1}`;
      if (sig === lastSig) return;
      lastSig = sig;

      g.clear();
      if (y1 <= y0) return;

      for (let x = x0; x <= x1; x++) {
        const sy = Math.max(y0, world.surfaceAt(x));
        if (y1 <= sy) continue;
        const depth = Math.max(0, sy - startRow);
        const band = Math.min(bands - 1, Math.floor(depth / 38));
        g.rect(x * CELL, sy * CELL, CELL, (y1 - sy) * CELL);
        g.fill(colors[band]);
      }
    };
    return g;
  }

  const surface = new Array(COLS);
  for (let x = 0; x < COLS; x++) {
    let s = 0;
    while (s < ROWS && world.get(x, s) === AIR) s++;
    surface[x] = s;
  }
  for (let b = 0; b < bands; b++) {
    const bandTop = Math.floor((ROWS * b) / bands);
    const bandBottom = Math.floor((ROWS * (b + 1)) / bands);
    for (let x = 0; x < COLS; x++) {
      const y0 = Math.max(surface[x], bandTop);
      if (bandBottom <= y0) continue;
      g.rect(x * CELL, y0 * CELL, CELL, (bandBottom - y0) * CELL);
    }
    g.fill(colors[b]);
  }
  return g;
}

export function createGoalLine(y, infinite = false) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const xStart = infinite ? -2000 * CELL : 0;
  const xEnd = infinite ? 2320 * CELL : COLS * CELL;
  for (let x = xStart; x < xEnd; x += 24) g.rect(x, y - 1, 12, 3);
  g.fill({ color: 0xffe066, alpha: 0.75 });
  c.addChild(g);

  const label = new PIXI.Text({
    text: infinite ? 'HITO 250 m' : 'META',
    style: { fontFamily: 'sans-serif', fontSize: 14, fill: 0xffe066 },
  });
  label.position.set((COLS / 2) * CELL, y - 20);
  c.addChild(label);
  return c;
}

export function createShop(col, groundY) {
  const c = new PIXI.Container();
  const w = 3.4 * CELL;
  const wallH = 1.6 * CELL;
  const roofH = 1.0 * CELL;

  const g = new PIXI.Graphics();

  g.rect(w * 0.16, 2, CELL * 0.45, roofH * 0.9).fill(0x5a5a66);
  g.rect(w * 0.12, 0, CELL * 0.53, 3).fill(0x3f3f48);

  g.rect(4, roofH, w - 8, wallH).fill(0x7a4928);
  for (let y = roofH + 5; y < roofH + wallH - 3; y += 6) {
    g.rect(4, y, w - 8, 1.5).fill(0x5c3419);
  }
  g.rect(2, roofH + wallH - 4, w - 4, 4).fill(0x4f5561);

  const doorW = CELL * 0.85;
  const doorH = CELL * 1.15;
  const doorX = w * 0.22;
  const doorY = roofH + wallH - doorH;
  g.rect(doorX, doorY, doorW, doorH).fill(0x472814);
  g.rect(doorX + 1.5, doorY + 1.5, doorW - 3, doorH - 1.5).stroke({ width: 1, color: 0x2e180b });
  g.circle(doorX + doorW - 3, doorY + doorH * 0.55, 1.3).fill(0xffcf5a);

  const winS = CELL * 0.65;
  const winX = w * 0.62;
  const winY = roofH + CELL * 0.35;
  g.rect(winX - 1.5, winY - 1.5, winS + 3, winS + 3).fill(0x3b200e);
  g.rect(winX, winY, winS, winS).fill(0xffcf5a);
  g.rect(winX + winS / 2 - 0.5, winY, 1, winS).fill(0x3b200e);
  g.rect(winX, winY + winS / 2 - 0.5, winS, 1).fill(0x3b200e);

  g.poly([
    -2, roofH + 2,
    w / 2, 0,
    w + 2, roofH + 2,
    w - 2, roofH + 5,
    w / 2, 4,
    2, roofH + 5,
  ]).fill(0x9e3b24);
  g.poly([
    2, roofH + 4,
    w / 2, 4,
    w - 2, roofH + 4,
  ]).fill(0x6e2717);

  const lx = doorX + doorW + 4;
  const ly = doorY + 4;
  g.circle(lx, ly + 2, 10).fill({ color: 0xffcf5a, alpha: 0.2 });
  g.rect(lx - 0.5, ly - 3, 1, 3).fill(0x222222);
  g.rect(lx - 2, ly, 4, 5).fill(0xffe066);

  c.addChild(g);

  const label = new PIXI.Text({
    text: 'TIENDA',
    style: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: 'bold',
      fill: 0xffe066,
      stroke: { color: 0x24150e, width: 3 },
    },
  });
  label.anchor.set(0.5, 1);
  label.position.set(w / 2, -2);
  c.addChild(label);

  c.position.set((col + 0.5) * CELL - w / 2, groundY - (roofH + wallH));
  return c;
}

export function createOutpost(col, groundY, index) {
  const c = new PIXI.Container();
  const w = 2.6 * CELL;
  const h = 2.1 * CELL;
  const g = new PIXI.Graphics();

  g.rect(2, h - 4, 6, 4).fill(0x4f5561);
  g.rect(w - 8, h - 4, 6, 4).fill(0x4f5561);
  g.roundRect(3, 4, w - 6, h - 7, 4).fill(0x2b3a4a);
  g.rect(3, 11, w - 6, 4).fill(0x4fe3ff);
  g.rect(w / 2 - 1, 0, 2, 4).fill(0xdfe6ee);
  g.circle(w / 2, 0, 3).fill(0x4fe3ff);

  c.addChild(g);

  const label = new PIXI.Text({
    text: `BASE #${index}`,
    style: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: 'bold',
      fill: 0x4fe3ff,
      stroke: { color: 0x101820, width: 3 },
    },
  });
  label.anchor.set(0.5, 1);
  label.position.set(w / 2, -3);
  c.addChild(label);

  c.position.set((col + 0.5) * CELL - w / 2, groundY - h);
  return c;
}

export function createBomb() {
  const g = new PIXI.Graphics();
  g.rect(-6, -6, 12, 12).fill(0xd62828);
  g.rect(-1.5, -11, 3, 6).fill(0xffe066);
  return g;
}

export function createEffects() {
  const g = new PIXI.Graphics();
  const beams = [];
  const waves = [];
  const puffs = [];

  return {
    layer: g,

    spawnLaser(ox, oy, ex, ey, level = 1) {
      beams.push({ ox, oy, ex, ey, level, life: 0.2, max: 0.2 });
    },

    spawnExplosion(x, y, maxRadius = DYNAMITE.radius * CELL) {
      waves.push({ x, y, maxR: maxRadius, life: 0.28, max: 0.28 });
    },

    spawnJetpackSmoke(x, y) {
      if (puffs.length > 60) return;
      puffs.push({
        x, y,
        vx: (Math.random() - 0.5) * 18,
        vy: 35 + Math.random() * 25,
        r: 2.5 + Math.random() * 1.5,
        life: 0.35,
        max: 0.35,
      });
    },

    update(dt) {
      if (!beams.length && !waves.length && !puffs.length) {
        g.clear();
        return;
      }
      g.clear();

      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life -= dt;
        if (p.life <= 0) { puffs.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += 10 * dt;
        g.circle(p.x, p.y, p.r).fill({ color: 0xd8dee9, alpha: (p.life / p.max) * 0.45 });
      }

      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        w.life -= dt;
        if (w.life <= 0) { waves.splice(i, 1); continue; }
        const t = 1 - w.life / w.max;
        const ease = 1 - (1 - t) * (1 - t);
        const r = w.maxR * ease;
        const alpha = (1 - t);

        if (t < 0.35) {
          g.circle(w.x, w.y, w.maxR * 0.75 * (1 - t)).fill({ color: 0xffe066, alpha: (0.35 - t) * 1.6 });
        }
        g.circle(w.x, w.y, r).stroke({ width: 4 * alpha + 1, color: 0xff9f1c, alpha: alpha * 0.85 });
        g.circle(w.x, w.y, r * 0.72).stroke({ width: 2 * alpha, color: 0xffffff, alpha: alpha * 0.65 });
      }

      for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i];
        b.life -= dt;
        if (b.life <= 0) { beams.splice(i, 1); continue; }
        const a = b.life / b.max;
        const outerColor = b.level >= 3 ? 0xb967ff : b.level === 2 ? 0x4fe3ff : 0xff4d4d;
        const width = 5 + b.level * 1.5;

        g.moveTo(b.ox, b.oy).lineTo(b.ex, b.ey)
          .stroke({ width: width * a + 2, color: outerColor, alpha: a * 0.45 });
        g.moveTo(b.ox, b.oy).lineTo(b.ex, b.ey)
          .stroke({ width: 2 * a + 0.5, color: 0xffffff, alpha: a * 0.95 });

        g.circle(b.ex, b.ey, (6 + b.level * 2) * a).fill({ color: outerColor, alpha: a * 0.55 });
        g.circle(b.ex, b.ey, 3 * a).fill({ color: 0xffffff, alpha: a });
      }
    },
  };
}

export function createFloatingTexts() {
  const layer = new PIXI.Container();
  const list = [];

  return {
    layer,
    spawn(x, y, text, color = 0xffe066) {
      const t = new PIXI.Text({
        text,
        style: {
          fontFamily: 'sans-serif',
          fontSize: 12,
          fontWeight: 'bold',
          fill: color,
          stroke: { color: 0x140d0a, width: 3 },
        },
      });
      t.anchor.set(0.5, 1);
      t.position.set(x, y);
      layer.addChild(t);
      list.push({ t, vy: -32, life: 0.95, max: 0.95 });
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        item.life -= dt;
        if (item.life <= 0) {
          layer.removeChild(item.t);
          item.t.destroy();
          list.splice(i, 1);
          continue;
        }
        item.t.y += item.vy * dt;
        item.vy *= 0.96;
        item.t.alpha = Math.min(1, (item.life / item.max) * 1.6);
      }
    },
  };
}

// Niebla de guerra subterránea con halo personal y cono de linterna (Modo Difícil)
export function createFogOfWar() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const texture = PIXI.Texture.from(canvas);
  const sprite = new PIXI.Sprite(texture);

  return {
    layer: sprite,
    update({ camX, camY, screenW, screenH, playerX, playerY, targetX, targetY, depth, flashLevel = 0 }) {
      sprite.position.set(camX, camY);

      // En superficie hay luz; apenas bajás de 0.5m empieza a oscurecer hasta 97%
      const darkness = Math.max(0, Math.min(0.97, (depth - 0.5) / 14));
      sprite.visible = darkness > 0.01;
      if (!sprite.visible) return;

      const w = Math.max(1, Math.ceil(screenW));
      const h = Math.max(1, Math.ceil(screenH));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const px = playerX - camX;
      const py = playerY - camY;
      const ang = Math.atan2(targetY - playerY, targetX - playerX);

      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgba(5, 6, 10, ${darkness})`;
      ctx.fillRect(0, 0, w, h);

      // Recortar luz con degradado suave en Canvas 2D (evita fallos de triangulación de .cut() en PixiJS v8)
      ctx.globalCompositeOperation = 'destination-out';

      // 1. Halo circular alrededor del minero
      const auraR = (3.2 + flashLevel * 0.9) * CELL;
      const halo = ctx.createRadialGradient(px, py, auraR * 0.35, px, py, auraR * 1.35);
      halo.addColorStop(0, 'rgba(0, 0, 0, 1)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, auraR * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // 2. Cono direccional de la linterna hacia el cursor
      const coneLen = (9.5 + flashLevel * 4.5) * CELL;
      const spread = 0.4 + flashLevel * 0.06;
      const cone = ctx.createRadialGradient(px, py, auraR * 0.25, px, py, coneLen);
      cone.addColorStop(0, 'rgba(0, 0, 0, 1)');
      cone.addColorStop(0.75, 'rgba(0, 0, 0, 0.85)');
      cone.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, coneLen, ang - spread, ang + spread);
      ctx.closePath();
      ctx.fill();

      texture.source.update();
    },
  };
}