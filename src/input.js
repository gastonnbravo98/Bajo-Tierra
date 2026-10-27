const keys = new Set();
const mouse = { x: 0, y: 0, down: false };
let rightQueued = false;
const BLOCKED = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

const typing = (e) => e.target instanceof HTMLInputElement;
// solo cuentan los clicks sobre el canvas del juego (no sobre la tienda ni el menú)
const onCanvas = (e) => e.target instanceof HTMLCanvasElement;

window.addEventListener('keydown', (e) => {
  if (typing(e)) return;
  if (BLOCKED.includes(e.code)) e.preventDefault();
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('pointerdown', (e) => {
  if (!onCanvas(e)) return;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  if (e.button === 0) mouse.down = true;
  if (e.button === 2) rightQueued = true;
});
window.addEventListener('pointerup', (e) => { if (e.button === 0) mouse.down = false; });
window.addEventListener('contextmenu', (e) => { if (onCanvas(e)) e.preventDefault(); });

window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

export const input = {
  get left()  { return keys.has('KeyA') || keys.has('ArrowLeft'); },
  get right() { return keys.has('KeyD') || keys.has('ArrowRight'); },
  get jump()  { return keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp'); },
  get mouseX() { return mouse.x; },
  get mouseY() { return mouse.y; },
  get mouseDown() { return mouse.down; },
  // true una sola vez por cada click derecho
  consumeRight() { const r = rightQueued; rightQueued = false; return r; },
};
