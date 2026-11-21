// Lorong Senja — player.js
// Gerak pemain, menyelinap, noise langkah, lempar pengalih, koleksi dokumen.

import { CONFIG } from './config.js';
import { collideCircle } from './world.js';

const C = CONFIG;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2; // menghadap atas
    this.sneaking = false;
    this.noiseTimer = 0;
    this.noisePulse = null; // { x, y, r, t } lingkaran suara yang terlihat sekilas
    this.throwCooldown = 0;
    this.throws = []; // koin/batu yang sedang terbang: { x, y, tx, ty, t }
    this.stepTimer = 0;
  }

  update(dt, game, input) {
    const mv = input.moveVector();
    this.sneaking = input.sneaking;
    const speed = this.sneaking ? C.PLAYER_SNEAK_SPEED : C.PLAYER_WALK_SPEED;
    const moving = mv.x !== 0 || mv.y !== 0;

    if (moving) {
      const pos = collideCircle(game.level, this.x, this.y, C.PLAYER_RADIUS, mv.x * speed * dt, mv.y * speed * dt);
      this.x = pos.x;
      this.y = pos.y;
      this.angle = Math.atan2(mv.y, mv.x);

      // Langkah kaki: bunyi + pulsa suara hanya bila TIDAK menyelinap.
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sneaking ? 0.55 : 0.38;
        game.audio.step(this.sneaking);
      }
      if (!this.sneaking) {
        this.noiseTimer -= dt;
        if (this.noiseTimer <= 0) {
          this.noiseTimer = C.WALK_NOISE_INTERVAL;
          this.noisePulse = { x: this.x, y: this.y, r: C.WALK_NOISE_RADIUS, t: 0.6 };
          game.emitNoise(this.x, this.y, C.WALK_NOISE_RADIUS);
        }
      }
    }

    if (this.noisePulse) {
      this.noisePulse.t -= dt;
      if (this.noisePulse.t <= 0) this.noisePulse = null;
    }

    // Lempar pengalih (klik mouse): koin/batu terbang ke titik klik.
    this.throwCooldown -= dt;
    for (const click of input.takeClicks()) {
      if (this.throwCooldown > 0) continue;
      const dist = Math.hypot(click.x - this.x, click.y - this.y);
      if (dist < 20 || dist > C.THROW_RANGE) continue;
      this.throwCooldown = C.THROW_COOLDOWN;
      this.throws.push({ sx: this.x, sy: this.y, x: this.x, y: this.y, tx: click.x, ty: click.y, t: 0, dur: 0.35 });
      game.audio.throwSound();
    }
    for (let i = this.throws.length - 1; i >= 0; i--) {
      const th = this.throws[i];
      th.t += dt;
      const k = Math.min(1, th.t / th.dur);
      th.x = th.sx + (th.tx - th.sx) * k;
      th.y = th.sy + (th.ty - th.sy) * k;
      if (k >= 1) {
        this.throws.splice(i, 1);
        game.emitNoise(th.tx, th.ty, C.THROW_NOISE_RADIUS, true);
        game.audio.clink();
        game.noiseFlashes.push({ x: th.tx, y: th.ty, r: C.THROW_NOISE_RADIUS, t: 0.8 });
      }
    }

    // Ambil dokumen (sentuh).
    for (const doc of game.level.documents) {
      if (!doc.taken && Math.hypot(doc.x - this.x, doc.y - this.y) < 26) {
        doc.taken = true;
        game.docsCollected += 1;
        game.score += C.SCORE_DOCUMENT;
        game.audio.pickup();
        game.banner('Dokumen didapat! ' + game.docsCollected + '/' + game.level.documents.length, 1.6);
      }
    }

    // Exit: hanya terbuka setelah semua dokumen diambil.
    if (game.docsCollected >= game.level.documents.length) {
      const e = game.level.exit;
      if (this.x > e.x && this.x < e.x + e.w && this.y > e.y && this.y < e.y + e.h) {
        game.winLevel();
      }
    }
  }
}
