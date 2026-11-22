// Lorong Senja — touch.js
// Kontrol sentuh: joystick virtual + tombol aksi. Hanya aktif di perangkat
// sentuh (pointer: coarse / touchstart) atau bila URL memakai ?touch=1.
// Tidak ada dependensi eksternal; terhubung ke antrean Input yang sama
// dengan keyboard/mouse (moveVector, running, crouching, interactQueue,
// takedownQueue, clickQueue) sehingga logika inti tidak berubah.

import { t } from './i18n.js';

const JOY_DEADZONE = 0.15;
const THROW_DIST = 220; // px ke arah hadap pemain (sama seperti klik mouse)

// Kunci i18n label tombol AKSI sesuai interaksi terdekat — satu sumber
// kebenaran, dipakai TouchControls DAN render.js (prompt sentuh).
// Keadaan lampu dibaca dari nearInteract.sw.on (sakelar punya field `on`).
export function actionLabelKey(game) {
  if (!game) return 'touch.actionDefault';
  const p = game.player;
  if (p && p.hiddenInLocker) return 'touch.actionExit';
  const n = game.nearInteract;
  if (!n) return 'touch.actionDefault';
  if (n.type === 'locker') return 'touch.actionHide';
  if (n.type === 'locker-exit') return 'touch.actionExit';
  if (n.type === 'switch') return n.sw && n.sw.on ? 'touch.actionOff' : 'touch.actionOn';
  return 'touch.actionDefault';
}

export class TouchControls {
  constructor(input, game) {
    this.input = input;
    this.game = game;
    this.crouchOn = false; // toggle jongkok sentuh (keyboard C tetap tahan)
    this._joyPointerId = null;
    this._joyBase = document.getElementById('joy-base');
    this._joyKnob = document.getElementById('joy-knob');
    this._bindJoystick();
    this._bindButtons();
    this.updateLabels();
  }

  static isTouchDevice() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('touch') === '1') return true;
    return (
      window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
    );
  }

  // -- label tombol (ikut bahasa aktif) --------------------------------------
  updateLabels() {
    const set = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.textContent = t(key);
    };
    set('tb-run', 'touch.run');
    set('tb-crouch', 'touch.crouch');
    set('tb-takedown', 'touch.takedown');
    set('tb-throw', 'touch.throw');
    set('btn-touch-pause', 'touch.pause');
    const crouchBtn = document.getElementById('tb-crouch');
    if (crouchBtn) crouchBtn.classList.toggle('active', this.crouchOn);
    // Label AKSI kontekstual (ganti bahasa langsung mengubah label).
    this._actionKey = null;
    this._takedownOn = null;
    this.updateActionState();
  }

  // Label + sorotan tombol AKSI mengikuti game.nearInteract — dipanggil
  // tiap frame dari main loop; DOM hanya disentuh bila ada yang berubah.
  updateActionState() {
    const key = actionLabelKey(this.game);
    if (key !== this._actionKey) {
      this._actionKey = key;
      const btn = document.getElementById('tb-action');
      if (btn) {
        btn.textContent = t(key);
        const hasAction = key !== 'touch.actionDefault';
        btn.classList.toggle('attention', hasAction);
        btn.classList.toggle('idle', !hasAction);
      }
    }
    const tdOn = !!(this.game && this.game.takedownTarget);
    if (tdOn !== this._takedownOn) {
      this._takedownOn = tdOn;
      const td = document.getElementById('tb-takedown');
      if (td) td.classList.toggle('attention', tdOn);
    }
  }

  // -- joystick ---------------------------------------------------------------
  _bindJoystick() {
    const base = this._joyBase;
    if (!base) return;
    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._joyPointerId = e.pointerId;
      try {
        base.setPointerCapture(e.pointerId);
      } catch (err) { /* abaikan */ }
      this._updateJoystick(e);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._joyPointerId) return;
      e.preventDefault();
      this._updateJoystick(e);
    });
    const end = (e) => {
      if (e.pointerId !== this._joyPointerId) return;
      this._joyPointerId = null;
      this.input.joystick = null;
      if (this._joyKnob) this._joyKnob.style.transform = 'translate(0px, 0px)';
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }

  _updateJoystick(e) {
    const rect = this._joyBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Jarak maksimum knob = setengah lebar base dikurangi setengah knob.
    const travel = Math.max(20, rect.width / 2 - 28);
    let dx = (e.clientX - cx) / travel;
    let dy = (e.clientY - cy) / travel;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    if (this._joyKnob) {
      this._joyKnob.style.transform =
        'translate(' + dx * travel + 'px,' + dy * travel + 'px)';
    }
    // Deadzone: sentuhan kecil di tengah = diam.
    if (mag < JOY_DEADZONE) {
      this.input.joystick = null;
      return;
    }
    this.input.joystick = { x: dx, y: dy };
  }

  // -- tombol aksi ------------------------------------------------------------
  _bindButtons() {
    const $ = (id) => document.getElementById(id);

    // Tombol tahan (LARI): pointerdown = aktif, lepas di mana pun = mati.
    const holdBtn = (el, down, up) => {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.classList.add('active');
        down();
      });
      const release = (e) => {
        if (!el.classList.contains('active')) return;
        el.classList.remove('active');
        up();
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };

    // Tombol tap (sekali per pointerdown — tanpa click, cegah double-fire).
    const tapBtn = (el, fn) => {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fn();
      });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };

    holdBtn($('tb-run'), () => {
      this.input.touchRun = true;
    }, () => {
      this.input.touchRun = false;
    });

    tapBtn($('tb-crouch'), () => {
      this.crouchOn = !this.crouchOn;
      this.input.touchCrouch = this.crouchOn;
      $('tb-crouch').classList.toggle('active', this.crouchOn);
    });

    tapBtn($('tb-action'), () => {
      this.input.interactQueue.push(true);
    });

    tapBtn($('tb-takedown'), () => {
      this.input.takedownQueue.push(true);
    });

    tapBtn($('tb-throw'), () => {
      const p = this.game.player;
      if (!p || p.hiddenInLocker) return;
      const tx = Math.max(20, Math.min(1260, p.x + Math.cos(p.angle) * THROW_DIST));
      const ty = Math.max(20, Math.min(700, p.y + Math.sin(p.angle) * THROW_DIST));
      this.input.clickQueue.push({ x: tx, y: ty });
    });

    const pauseBtn = $('btn-touch-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.input.onPause) this.input.onPause();
      });
    }
  }
}
