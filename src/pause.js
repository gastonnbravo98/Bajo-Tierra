import { SIZES, IS_HARD } from './config.js';
import { mmss } from './debug.js';

/**
 * Crea el controlador del menú de pausa y sus controles de audio y vista.
 */
export function createPauseMenu(els, sound, callbacks) {
  const {
    pauseEl, pauseInfoEl, btnResume, volumeLabel, volumeSlider,
    toggleMusicEl, boxMusicEl, toggleSfxEl, boxSfxEl,
    btnCopySeed, btnToggleDebug, btnToggleSim, btnToggleMap,
    btnRestart, btnExit,
  } = els;

  let open = false;

  function syncLabels(state) {
    const { seed, sizeKey, playTime, debugOn, simView, bigMap } = state;
    pauseInfoEl.textContent = `Seed: ${seed} · ${SIZES[sizeKey].name} (${IS_HARD ? 'Difícil' : 'Fácil'}) · ${mmss(playTime)}`;
    const pct = Math.round(sound.volume * 100);
    volumeLabel.textContent = `Volumen: ${pct}%`;
    volumeSlider.value = String(pct);

    toggleMusicEl.classList.toggle('muted', sound.musicMuted);
    toggleMusicEl.setAttribute('aria-checked', String(sound.musicMuted));
    boxMusicEl.textContent = sound.musicMuted ? '✕' : '';

    toggleSfxEl.classList.toggle('muted', sound.sfxMuted);
    toggleSfxEl.setAttribute('aria-checked', String(sound.sfxMuted));
    boxSfxEl.textContent = sound.sfxMuted ? '✕' : '';

    btnCopySeed.textContent = 'Copiar seed';
    btnToggleDebug.textContent = `Depuración (U): ${debugOn ? 'Activada' : 'Desactivada'}`;
    btnToggleSim.textContent = `Vista simulación (V): ${simView ? 'Activada' : 'Desactivada'}`;
    btnToggleMap.textContent = `Minimapa (M): ${bigMap ? 'Grande' : 'Normal'}`;
  }

  function setOpen(value, state) {
    open = value;
    if (open) {
      sound.stopJetpack();
      syncLabels(state);
      pauseEl.style.display = 'flex';
    } else {
      pauseEl.style.display = 'none';
    }
  }

  btnResume.onclick = () => callbacks.onResume();
  volumeSlider.oninput = () => {
    sound.setVolume(Number(volumeSlider.value) / 100);
    volumeLabel.textContent = `Volumen: ${volumeSlider.value}%`;
  };
  toggleMusicEl.onclick = () => {
    sound.toggleMusic();
    syncLabels(callbacks.getState());
  };
  toggleSfxEl.onclick = () => {
    sound.toggleSfx();
    syncLabels(callbacks.getState());
  };
  btnCopySeed.onclick = () => {
    navigator.clipboard?.writeText(String(callbacks.getState().seed));
    btnCopySeed.textContent = '¡Seed copiada!';
  };
  btnToggleDebug.onclick = () => {
    callbacks.onToggleDebug();
    syncLabels(callbacks.getState());
  };
  btnToggleSim.onclick = () => {
    callbacks.onToggleSim();
    syncLabels(callbacks.getState());
  };
  btnToggleMap.onclick = () => {
    callbacks.onToggleMap();
    syncLabels(callbacks.getState());
  };
  btnRestart.onclick = () => callbacks.onRestart();
  btnExit.onclick = () => callbacks.onExit();

  return {
    get isOpen() { return open; },
    setOpen,
    hide() {
      open = false;
      pauseEl.style.display = 'none';
    },
  };
}
