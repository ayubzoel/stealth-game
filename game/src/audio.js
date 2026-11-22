// Lorong Senja — audio.js
// Semua SFX dibuat dengan Web Audio API (oscillator + noise buffer).
// Tanpa file audio eksternal. M = mute.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  // Dipanggil pada interaksi pertama (klik/tombol) agar AudioContext diizinkan.
  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol, lowFreq) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowFreq || 800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.15, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  step(quiet) {
    // Langkah kaki: bunyi pelan; jongkok nyaris tak terdengar.
    this._noise(0.07, quiet ? 0.03 : 0.09, 500);
  }

  suspicious() {
    // Blip curiga: dua nada naik.
    this._tone(620, 0.12, 'square', 0.12);
    setTimeout(() => this._tone(830, 0.14, 'square', 0.12), 110);
  }

  alarm() {
    // Alarm kejar: nada sawtooth turun-naik cepat.
    this._tone(880, 0.25, 'sawtooth', 0.14, 440);
    setTimeout(() => this._tone(880, 0.25, 'sawtooth', 0.14, 440), 240);
  }

  pickup() {
    // Chime ambil dokumen.
    this._tone(880, 0.12, 'sine', 0.2);
    setTimeout(() => this._tone(1318, 0.2, 'sine', 0.2), 90);
  }

  throwSound() {
    this._noise(0.12, 0.08, 2000);
  }

  clink() {
    // Koin jatuh: bunyi metalik pendek.
    this._tone(2093, 0.09, 'triangle', 0.16);
    setTimeout(() => this._tone(1568, 0.12, 'triangle', 0.12), 70);
  }

  win() {
    // Jingle menang: arpeggio naik.
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.28, 'sine', 0.2), i * 130);
    });
  }

  lose() {
    // Jingle kalah: nada turun.
    [392, 330, 262, 196].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.3, 'triangle', 0.18), i * 150);
    });
  }
}
