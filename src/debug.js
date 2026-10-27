export function mmss(seconds) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// HUD de depuración (tecla U): FPS, datos del juego y un registro de las últimas acciones
export function createDebug(el, visibleAtStart) {
  const events = [];
  let visible = visibleAtStart;
  let clock = 0;
  let acc = 0, frames = 0, fps = 0, ms = 0;
  let since = 1;
  let dirty = true;
  el.style.display = visible ? 'block' : 'none';

  return {
    get visible() { return visible; },

    toggle() {
      visible = !visible;
      el.style.display = visible ? 'block' : 'none';
      dirty = true;
      return visible;
    },

    // anota una acción con la hora de la partida
    log(text) {
      events.unshift({ t: clock, text });
      if (events.length > 8) events.pop();
      dirty = true;
    },

    // se llama una vez por frame; infoFn solo se ejecuta si el panel se ve y toca refrescarlo
    frame(dt, infoFn) {
      clock += dt;
      frames++;
      acc += dt;
      if (acc >= 0.5) {
        fps = Math.round(frames / acc);
        ms = (acc / frames) * 1000;
        frames = 0;
        acc = 0;
        dirty = true;
      }
      since += dt;
      if (!visible || (since < 0.1 && !dirty)) return;
      since = 0;
      dirty = false;
      const lines = [
        'Depuración (U para ocultar)',
        `FPS: ${fps}  (${ms.toFixed(1)} ms por frame)`,
        ...infoFn(),
        '',
        'Últimas acciones:',
        ...(events.length ? events.map((e) => `${mmss(e.t)}  ${e.text}`) : ['(ninguna todavía)']),
      ];
      el.textContent = lines.join('\n');
    },
  };
}
