const keys = new Set();
const BLOCKED = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

window.addEventListener('keydown', (e) => {
  if (BLOCKED.includes(e.code)) e.preventDefault(); // evita que la página scrollee
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear()); // si cambiás de pestaña, soltar todo

export const input = {
  get left()  { return keys.has('KeyA') || keys.has('ArrowLeft'); },
  get right() { return keys.has('KeyD') || keys.has('ArrowRight'); },
  get jump()  { return keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp'); },
};