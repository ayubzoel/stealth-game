// Lorong Senja — player.js
// Gerak pemain (Walk sunyi / Run bersuara / Crouch pelan + hitbox kecil),
// noise langkah lari, lempar pengalih, koleksi dokumen, status sembunyi.

import { CONFIG } from './config.js';
import { collideCircle, isInBush } from './world.js';

const C = CONFIG;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2; // menghadap atas
    this.crouching = false;
    this.running = false;
    this.inBush = false;
    this.hiddenInLocker = false;
    this.lockerEntry = null; // { x, y } posisi sebelum masuk lemari
    this.noiseTimer = 0;
    this.noisePulse = null; // { x, y, r, t } lingkaran suara yang terlihat sekilas
    this.throwCooldown = 0;
    this.throws = []; // koin/batu yang sedang terbang: { x, y, tx, ty, t }
    this.stepTimer = 0;
    this.forceCrouch = false; // mode ?shot=play: jongkok tanpa tahan C
  }

  // Radius tabrakan saat ini (jongkok ~30% lebih kecil).
  get radius() {
    return this.crouching ? C.PLAYER_CROUCH_RADIUS : C.PLAYER_RADIUS;
  }

  // Mode gerak: 'crouch' | 'run' | 'walk'. Jongkok menang atas lari.
  get mode() {
    if (this.crouching) return 'crouch';
    if (this.running) return 'run';
    return 'walk';
  }

  update(dt, game, input) {
    this.crouching = input.crouching || this.forceCrouch;
    this.running = input.running && !this.crouching;
    this.inBush = isInBush(game.level, this.x, this.y);

    // Di dalam lemari: diam, tidak bisa bergerak / melempar / terlihat.
    if (this.hiddenInLocker) return;

    const mv = input.moveVector();
    const speed =
      this.mode === 'crouch'
        ? C.PLAYER_CROUCH_SPEED
        : this.mode === 'run'
          ? C.PLAYER_RUN_SPEED
          : C.PLAYER_WALK_SPEED;
    const moving = mv.x !== 0 || mv.y !== 0;

    if (moving) {
      const r = this.radius;
      const pos = collideCircle(game.level, this.x, this.y, r, mv.x * speed * dt, mv.y * speed * dt);
      this.x = pos.x;
      this.y = pos.y;
      this.angle = Math.atan2(mv.y, mv.x);

      // Langkah kaki: jongkok nyaris tak terdengar.
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.crouching ? 0.55 : this.running ? 0.3 : 0.42;
        game.audio.step(this.crouching);
      }
      // Hanya LARI yang bersuara (pulsa noise terlihat + menarik guard).
      if (this.running) {
        this.noiseTimer -= dt;
        if (this.noiseTimer <= 0) {
          this.noiseTimer = C.RUN_NOISE_INTERVAL;
          this.noisePulse = { x: this.x, y: this.y, r: C.RUN_NOISE_RADIUS, t: 0.6 };
          game.emitNoise(this.x, this.y, C.RUN_NOISE_RADIUS);
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
        game.setCheckpoint(this.x, this.y);
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
