// Lorong Senja — main.js
// Game loop, state (title / playing / paused / won / lost), level select,
// HUD, dan Debug API window.__STEALTH__ untuk tester.

import { CONFIG } from './config.js';
import { LEVELS, lightAt } from './world.js';
import { buildGuards, buildCameras, Guard } from './guards.js';
import { Player } from './player.js';
import { Renderer } from './render.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { applyShot } from './shots.js';

const C = CONFIG;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.audio = new AudioEngine();
    this.input = new Input(this.canvas);
    this.phase = 'title'; // title | playing | paused | won | lost
    this.levelIndex = 0;
    this.level = null;
    this.player = null;
    this.guards = [];
    this.cameras = [];
    this.detection = 0;
    this.score = 0;
    this.docsCollected = 0;
    this.timeElapsed = 0;
    this.nearMisses = 0;
    this.peakDetection = 0;
    this.nearMissCooldown = 0;
    this.noiseFlashes = [];
    this.bannerText = '';
    this.bannerTimer = 0;
    this.lastTime = 0;
    this.fps = 0;
    this._fpsFrames = 0;
    this._fpsTime = 0;
    this._loseReason = '';
    this._winTime = 0;

    this.input.onPause = () => this.togglePause();
    this.input.onRestart = () => {
      if (this.phase === 'playing' || this.phase === 'lost' || this.phase === 'won') {
        this.startLevel(this.levelIndex);
      }
    };
    this.input.onMute = () => {
      const muted = this.audio.toggleMute();
      this.banner(muted ? 'Suara dimatikan (M)' : 'Suara dinyalakan (M)', 1.2);
    };
    this.input.onEscape = () => {
      if (this.phase === 'playing' || this.phase === 'paused') this.showTitle();
    };
    this.input.onAnyKey = () => this.audio.ensure();

    this.bindMenuButtons();
    this.showTitle();
    this.updateHUD();
    requestAnimationFrame((t) => this.loop(t));
  }

  // -- menu / overlay -------------------------------------------------------
  $(id) {
    return document.getElementById(id);
  }

  hideAllOverlays() {
    for (const id of ['title-screen', 'howto-screen', 'levels-screen', 'pause-screen', 'win-screen', 'lose-screen']) {
      this.$(id).classList.add('hidden');
    }
  }

  showTitle() {
    this.phase = 'title';
    this.hideAllOverlays();
    this.$('title-screen').classList.remove('hidden');
  }

  showHowTo() {
    this.hideAllOverlays();
    this.$('howto-screen').classList.remove('hidden');
  }

  showLevels() {
    this.hideAllOverlays();
    this.$('levels-screen').classList.remove('hidden');
  }

  togglePause() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.hideAllOverlays();
      this.$('pause-screen').classList.remove('hidden');
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.hideAllOverlays();
    }
  }

  bindMenuButtons() {
    const bind = (id, fn) => {
      const el = this.$(id);
      if (el) el.addEventListener('click', () => {
        this.audio.ensure();
        fn();
      });
    };
    bind('btn-play', () => this.startLevel(this.levelIndex));
    bind('btn-howto', () => this.showHowTo());
    bind('btn-levels', () => this.showLevels());
    bind('btn-howto-back', () => this.showTitle());
    bind('btn-levels-back', () => this.showTitle());
    bind('btn-resume', () => this.togglePause());
    bind('btn-restart-pause', () => this.startLevel(this.levelIndex));
    bind('btn-quit-pause', () => this.showTitle());
    bind('btn-next-level', () => {
      if (this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1);
      else this.showTitle();
    });
    bind('btn-replay-win', () => this.startLevel(this.levelIndex));
    bind('btn-menu-win', () => this.showTitle());
    bind('btn-retry-lose', () => this.startLevel(this.levelIndex));
    bind('btn-menu-lose', () => this.showTitle());
    document.querySelectorAll('[data-level]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.ensure();
        this.startLevel(parseInt(el.dataset.level, 10));
      });
    });
  }

  // -- level ----------------------------------------------------------------
  startLevel(n) {
    this.levelIndex = n;
    // Salin definisi level agar dokumen bisa di-reset per permainan.
    const def = LEVELS[n];
    this.level = {
      ...def,
      documents: def.documents.map((d) => ({ ...d, taken: false })),
    };
    this.player = new Player(def.playerSpawn.x, def.playerSpawn.y);
    this.guards = buildGuards(this.level);
    this.cameras = buildCameras(this.level);
    this.detection = 0;
    this.peakDetection = 0;
    this.score = 0;
    this.docsCollected = 0;
    this.timeElapsed = 0;
    this.nearMisses = 0;
    this.nearMissCooldown = 0;
    this.noiseFlashes = [];
    this.bannerText = '';
    this.bannerTimer = 0;
    this.phase = 'playing';
    this.hideAllOverlays();
    this.updateHUD();
  }

  giveDocuments() {
    if (!this.level) return 0;
    for (const d of this.level.documents) d.taken = true;
    this.docsCollected = this.level.documents.length;
    return this.docsCollected;
  }

  teleport(x, y) {
    if (this.player) {
      this.player.x = x;
      this.player.y = y;
    }
    return this.player ? { x: this.player.x, y: this.player.y } : null;
  }

  winLevel() {
    if (this.phase !== 'playing') return;
    this.phase = 'won';
    this._winTime = this.timeElapsed;
    const timeBonus = Math.max(0, Math.round((this.level.parTime - this.timeElapsed) * C.SCORE_LEVEL_TIME_BONUS));
    this.score += timeBonus;
    this.audio.win();
    this.$('win-time').textContent = this.formatTime(this._winTime);
    this.$('win-score').textContent = this.score;
    this.$('win-docs').textContent = this.docsCollected + '/' + this.level.documents.length;
    this.$('win-bonus').textContent = '+' + timeBonus;
    this.$('win-level-name').textContent = this.level.name;
    this.$('btn-next-level').textContent =
      this.levelIndex + 1 < LEVELS.length ? 'Level Berikutnya' : 'Kembali ke Menu';
    this.hideAllOverlays();
    this.$('win-screen').classList.remove('hidden');
    this.updateHUD();
  }

  loseLevel(reason) {
    if (this.phase !== 'playing') return;
    this.phase = 'lost';
    this._loseReason = reason || 'tertangkap';
    this.audio.lose();
    this.$('lose-reason').textContent =
      this._loseReason === 'tertangkap'
        ? 'Raka tertangkap penjaga gudang!'
        : 'Raka ketahuan!';
    this.$('lose-level-name').textContent = this.level.name;
    this.$('lose-docs').textContent = this.docsCollected + '/' + this.level.documents.length;
    this.hideAllOverlays();
    this.$('lose-screen').classList.remove('hidden');
    this.updateHUD();
  }

  // Suara menarik guard dalam radius: mereka menyelidiki titik suara.
  emitNoise(x, y, radius, strong) {
    for (const g of this.guards) {
      if (g.state === 'chase') continue;
      const d = Math.hypot(g.x - x, g.y - y);
      if (d < radius + 60) {
        g.state = 'suspicious';
        g.lastSeen = { x, y };
        g.investigateTimer = strong ? 5 : 3;
      }
    }
  }

  banner(text, seconds) {
    this.bannerText = text;
    this.bannerTimer = seconds;
  }

  formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  }

  // -- loop -----------------------------------------------------------------
  loop(t) {
    requestAnimationFrame((nt) => this.loop(nt));
    const dt = Math.min(0.05, this.lastTime ? (t - this.lastTime) / 1000 : 0.016);
    // FPS dari waktu nyata (bukan dt yang di-cap) agar tidak menyesatkan.
    const realDt = this.lastTime ? (t - this.lastTime) / 1000 : 0.016;
    this.lastTime = t;
    this._fpsFrames += 1;
    this._fpsTime += realDt;
    if (this._fpsTime >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsTime);
      this._fpsFrames = 0;
      this._fpsTime = 0;
    }

    if (this.phase === 'playing') {
      this.timeElapsed += dt;
      this.player.update(dt, this, this.input);
      for (const g of this.guards) g.update(dt, this);
      for (const cam of this.cameras) cam.update(dt, this);

      // Meter deteksi turun saat tidak ada yang melihat pemain.
      const anySeeing =
        this.guards.some((g) => g.seesPlayer) || this.cameras.some((c) => c.seesPlayer);
      if (!anySeeing) {
        this.detection = Math.max(0, this.detection - C.DETECT_DECAY * dt);
        // Guard yang sedang curiga kembali tenang bila meter rendah.
        if (this.detection < C.SUSPICIOUS_AT) {
          for (const g of this.guards) {
            if (g.state === 'suspicious' && g.investigateTimer <= 0) g.state = 'return';
          }
        }
      }

      // Near-miss: meter pernah tinggi lalu turun tanpa tertangkap.
      this.peakDetection = Math.max(this.peakDetection, this.detection);
      this.nearMissCooldown -= dt;
      if (
        this.peakDetection >= C.NEAR_MISS_PEAK &&
        this.detection < C.NEAR_MISS_CLEAR &&
        this.nearMissCooldown <= 0 &&
        this.phase === 'playing'
      ) {
        this.nearMisses += 1;
        this.peakDetection = 0;
        this.nearMissCooldown = 8;
        this.score = Math.max(0, this.score - C.SCORE_NEAR_MISS_PENALTY);
        this.detection = Math.min(100, this.detection + 8); // alarm naik sedikit
        this.banner('Hampir terlihat!', 2.2);
        this.audio.suspicious();
      }

      for (const f of this.noiseFlashes) f.t -= dt;
      this.noiseFlashes = this.noiseFlashes.filter((f) => f.t > 0);
      if (this.bannerTimer > 0) this.bannerTimer -= dt;
      this.updateHUD();
    }

    if (this.level) this.renderer.draw(this);
  }

  // -- HUD ------------------------------------------------------------------
  updateHUD() {
    if (!this.level) {
      this.$('hud-level').textContent = 'Lorong Senja';
      return;
    }
    this.$('hud-level').textContent = 'Level ' + (this.levelIndex + 1) + ' — ' + this.level.name;
    this.$('hud-docs').textContent = 'Dokumen ' + this.docsCollected + '/' + this.level.documents.length;
    this.$('hud-time').textContent = this.formatTime(this.timeElapsed);
    this.$('hud-score').textContent = 'Skor ' + this.score;
    this.$('hud-sneak').textContent = this.player && this.player.sneaking ? 'MENYELINAP' : '';
    const meter = this.$('hud-meter-fill');
    meter.style.width = Math.round(this.detection) + '%';
    meter.className = 'meter-fill ' + (this.detection >= C.CHASE_AT ? 'danger' : this.detection >= C.SUSPICIOUS_AT ? 'warn' : '');
    this.$('hud-meter-label').textContent =
      'Terdeteksi ' + Math.round(this.detection) + '%' +
      (this.detection >= C.CHASE_AT ? ' — LARI!' : this.detection >= C.SUSPICIOUS_AT ? ' — Curiga!' : '');
    this.$('hud-exit').textContent =
      this.docsCollected >= this.level.documents.length ? 'Pintu keluar TERBUKA — lari ke EXIT!' : 'Ambil semua dokumen untuk membuka pintu keluar';
    const p = this.player;
    if (p) {
      const light = lightAt(this.level, p.x, p.y);
      this.$('hud-light').textContent = light > 0.55 ? 'TERANG — mudah terlihat!' : light > 0.25 ? 'Remang' : 'GELAP — aman bersembunyi';
      this.$('hud-light').className = light > 0.55 ? 'light-warn' : '';
    }
  }
}

// -- boot -------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  applyShot(game);

  // Debug API untuk tester (Playwright / konsol).
  window.__STEALTH__ = {
    state() {
      return {
        phase: game.phase,
        level: game.levelIndex + 1,
        levelName: game.level ? game.level.name : null,
        player: game.player ? { x: Math.round(game.player.x), y: Math.round(game.player.y), sneaking: game.player.sneaking } : null,
        guards: game.guards.map((g) => ({ x: Math.round(g.x), y: Math.round(g.y), state: g.state, seesPlayer: g.seesPlayer })),
        cameras: game.cameras.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), seesPlayer: c.seesPlayer })),
        detection: Math.round(game.detection),
        docsCollected: game.docsCollected,
        docsTotal: game.level ? game.level.documents.length : 0,
        score: game.score,
        nearMisses: game.nearMisses,
      };
    },
    stats() {
      return {
        fps: game.fps,
        score: game.score,
        docsCollected: game.docsCollected,
        time: Math.round(game.timeElapsed * 10) / 10,
        detection: Math.round(game.detection),
        phase: game.phase,
      };
    },
    startLevel(n) {
      game.startLevel(n - 1);
      return game.phase;
    },
    teleport(x, y) {
      return game.teleport(x, y);
    },
    setDetection(v) {
      game.detection = Math.max(0, Math.min(100, v));
      return game.detection;
    },
    spawnGuard(x, y) {
      // Spawn guard patroli baru di titik (x,y) dengan waypoint di sekitarnya.
      const g = new Guard(x, y, [
        { x, y },
        { x: x + 80, y },
        { x: x + 80, y: y + 80 },
        { x, y: y + 80 },
      ]);
      game.guards.push(g);
      return game.guards.length;
    },
    giveDocuments() {
      return game.giveDocuments();
    },
  };
});
