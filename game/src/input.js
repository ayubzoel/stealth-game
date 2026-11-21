// Lorong Senja — input.js
// Keyboard + mouse. Tidak ada dependensi eksternal.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.clickQueue = []; // { x, y } dalam koordinat canvas logis
    this.onPause = null;
    this.onRestart = null;
    this.onMute = null;
    this.onEscape = null;
    this.onAnyKey = null;

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        e.preventDefault();
      }
      if (!e.repeat) {
        if (k === 'p' && this.onPause) this.onPause();
        if (k === 'r' && this.onRestart) this.onRestart();
        if (k === 'm' && this.onMute) this.onMute();
        if (k === 'escape' && this.onEscape) this.onEscape();
      }
      this.keys.add(k);
      if (this.onAnyKey) this.onAnyKey(k);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 1280;
      const y = ((e.clientY - rect.top) / rect.height) * 720;
      this.clickQueue.push({ x, y });
    });
  }

  // Vektor gerak ternormalisasi dari WASD / panah.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  get sneaking() {
    return this.keys.has('shift');
  }

  takeClicks() {
    const out = this.clickQueue;
    this.clickQueue = [];
    return out;
  }
}
