const MAX = 350;

// Escombros y polvo: cuadraditos que saltan, caen y se desvanecen.
// Son solo visuales (no chocan con el terreno). Todos se dibujan en un único Graphics.
export function createParticles() {
  const g = new PIXI.Graphics();
  const list = [];
  let drawn = false;

  return {
    layer: g,
    get count() { return list.length; },

    // power > 1 = salen más rápido (explosiones)
    spawn(x, y, color, n = 1, power = 1) {
      for (let k = 0; k < n && list.length < MAX; k++) {
        const life = 0.4 + Math.random() * 0.5;
        list.push({
          x, y,
          vx: (Math.random() - 0.5) * 160 * power,
          vy: -(40 + Math.random() * 140) * power,
          life, max: life,
          size: 2 + Math.random() * 3,
          color,
        });
      }
    },

    update(dt) {
      if (list.length === 0 && !drawn) return;
      g.clear();
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        p.vy += 700 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        g.rect(p.x, p.y, p.size, p.size).fill({ color: p.color, alpha: p.life / p.max });
      }
      drawn = list.length > 0;
    },
  };
}
