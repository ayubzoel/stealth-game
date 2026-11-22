// Lorong Senja — touch.js
// Kontrol sentuh: joystick virtual + tombol aksi. Hanya aktif di perangkat
// sentuh (pointer: coarse / touchstart) atau bila URL memakai ?touch=1.
// Tidak ada dependensi eksternal; terhubung ke antrean Input yang sama
// dengan keyboard/mouse (moveVector, running, crouching, interactQueue,
// takedownQueue, clickQueue) sehingga logika inti tidak berubah.

import { t } from './i18n.js';

const JOY_TRAVEL = 32; // px gerak maksimum knob dari tengah
const JOY_DEADZONE = 0.15;
const THROW_DIST = 220; // px ke arah hadap pemain (sama seperti klik mouse)

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
    set('tb-action', 'touch.action');
    set('tb-takedown', 'touch.takedown');
    set('tb-throw', 'touch.throw');
    set('btn-touch-pause', 'touch.pause');
    const crouchBtn = document.getElementById('tb-crouch');
    if (crouchBtn) crouchBtn.classList.toggle('active', this.crouchOn);
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
    let dx = (e.clientX - cx) / JOY_TRAVEL;
    let dy = (e.clientY - cy) / JOY_TRAVEL;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    if (this._joyKnob) {
      this._joyKnob.style.transform =
        'translate(' + dx * JOY_TRAVEL + 'px,' + dy * JOY_TRAVEL + 'px)';
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
