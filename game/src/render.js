// Lorong Senja — render.js
// Menggambar dunia di canvas: lantai, dinding, cover, lampion, guard + cone,
// pemain, dokumen, exit, kegelapan, dan efek suara.

import { CONFIG } from './config.js';

const C = CONFIG;
const TILE = C.TILE;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Kanvas offscreen untuk lapisan kegelapan + lubang cahaya.
    this.dark = document.createElement('canvas');
    this.dark.width = C.CANVAS_W;
    this.dark.height = C.CANVAS_H;
    this.darkCtx = this.dark.getContext('2d');
    this.time = 0;
  }

  draw(game) {
    const ctx = this.ctx;
    const level = game.level;
    this.time += 1 / 60;
    ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    this.drawFloor(ctx, level);
    this.drawExit(ctx, level, game);
    this.drawDocuments(ctx, level);
    this.drawCovers(ctx, level);
    this.drawBushes(ctx, level);
    this.drawLockers(ctx, level, game);
    this.drawSwitches(ctx, level);
    this.drawWalls(ctx, level);
    this.drawLanterns(ctx, level);
    this.drawCones(ctx, game);
    this.drawGuards(ctx, game);
    this.drawTakenDown(ctx, game);
    this.drawCameras(ctx, game);
    this.drawPlayer(ctx, game);
    this.drawNoise(ctx, game);
    this.drawDarkness(ctx, game);
    this.drawBanner(ctx, game);
    this.drawPrompts(ctx, game);
  }

  drawFloor(ctx, level) {
    for (let ty = 0; ty < C.ROWS; ty++) {
      for (let tx = 0; tx < C.COLS; tx++) {
        const key = tx + ',' + ty;
        if (level.walls.has(key)) continue;
        ctx.fillStyle = (tx + ty) % 2 === 0 ? C.COLORS.floorDark : C.COLORS.floorLight;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }

  drawWalls(ctx, level) {
    for (const key of level.walls) {
      const [tx, ty] = key.split(',').map(Number);
      ctx.fillStyle = C.COLORS.wall;
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      ctx.strokeStyle = C.COLORS.wallEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
    }
  }

  drawCovers(ctx, level) {
    for (const c of level.covers) {
      if (c.kind === 'C') {
        ctx.fillStyle = C.COLORS.crate;
        ctx.fillRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
        ctx.strokeStyle = C.COLORS.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
        ctx.beginPath();
        ctx.moveTo(c.x + 3, c.y + 3);
        ctx.lineTo(c.x + c.w - 3, c.y + c.h - 3);
        ctx.moveTo(c.x + c.w - 3, c.y + 3);
        ctx.lineTo(c.x + 3, c.y + c.h - 3);
        ctx.stroke();
      } else if (c.kind === 'K') {
        // Kios: atap bergaris + badan.
        ctx.fillStyle = C.COLORS.kiosk;
        ctx.fillRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
        ctx.strokeStyle = C.COLORS.kioskEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
        ctx.fillStyle = '#8a2f3d';
        ctx.fillRect(c.x + 2, c.y + 2, c.w - 4, 10);
        ctx.fillStyle = 'rgba(255, 220, 130, 0.5)';
        ctx.fillRect(c.x + 8, c.y + 16, c.w - 16, 4);
      } else {
        // Tong: lingkaran.
        ctx.fillStyle = C.COLORS.barrel;
        ctx.beginPath();
        ctx.arc(c.x + TILE / 2, c.y + TILE / 2, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = C.COLORS.barrelEdge;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c.x + TILE / 2, c.y + TILE / 2, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  drawBushes(ctx, level) {
    // Semak: rumpun hijau — bisa dilewati, sembunyi di dalamnya.
    for (const b of level.bushes) {
      ctx.fillStyle = '#1d4d2b';
      ctx.beginPath();
      ctx.arc(b.cx - 8, b.cy + 4, 12, 0, Math.PI * 2);
      ctx.arc(b.cx + 8, b.cy + 4, 12, 0, Math.PI * 2);
      ctx.arc(b.cx, b.cy - 8, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f7a44';
      ctx.beginPath();
      ctx.arc(b.cx - 8, b.cy + 2, 7, 0, Math.PI * 2);
      ctx.arc(b.cx + 8, b.cy + 2, 7, 0, Math.PI * 2);
      ctx.arc(b.cx, b.cy - 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4caf6d';
      ctx.beginPath();
      ctx.arc(b.cx - 4, b.cy - 4, 3, 0, Math.PI * 2);
      ctx.arc(b.cx + 6, b.cy + 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawLockers(ctx, level, game) {
    // Lemari: kabinet tinggi — E di dekatnya untuk masuk/keluar.
    for (const o of level.lockers) {
      const occupied = game.player && game.player.hiddenInLocker &&
        Math.hypot(game.player.x - o.cx, game.player.y - o.cy) < 5;
      ctx.fillStyle = occupied ? '#3f4a63' : '#2e3a52';
      ctx.fillRect(o.x + 4, o.y + 2, o.w - 8, o.h - 4);
      ctx.strokeStyle = occupied ? '#2dd4bf' : '#64748b';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x + 4, o.y + 2, o.w - 8, o.h - 4);
      ctx.strokeStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(o.cx, o.y + 2);
      ctx.lineTo(o.cx, o.y + o.h - 2);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(o.cx - 5, o.cy - 2, 3, 4);
      ctx.fillRect(o.cx + 2, o.cy - 2, 3, 4);
    }
  }

  drawSwitches(ctx, level) {
    // Sakelar lampu di lantai: kotak kecil + lampu status.
    for (const s of level.switches) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(s.x - 8, s.y - 8, 16, 16);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x - 8, s.y - 8, 16, 16);
      ctx.fillStyle = s.on ? '#fbbf24' : '#475569';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawLanterns(ctx, level) {
    for (const l of level.lanterns) {
      if (l.on === false) {
        // Lampion mati: badan redup, tanpa cahaya.
        ctx.fillStyle = '#5b3a3a';
        ctx.beginPath();
        ctx.ellipse(l.x, l.y, 9, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const flicker = 0.85 + Math.sin(this.time * 3 + l.x) * 0.15;
      const grad = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, 90 * flicker);
      grad.addColorStop(0, 'rgba(255, 200, 110, 0.85)');
      grad.addColorStop(0.4, 'rgba(255, 170, 70, 0.28)');
      grad.addColorStop(1, 'rgba(255, 170, 70, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 90 * flicker, 0, Math.PI * 2);
      ctx.fill();
      // Badan lampion.
      ctx.fillStyle = '#ff5a3c';
      ctx.beginPath();
      ctx.ellipse(l.x, l.y, 9, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(l.x - 3, l.y - 4, 6, 8);
    }
  }

  drawExit(ctx, level, game) {
    const e = level.exit;
    const open = game.docsCollected >= level.documents.length;
    const pulse = open ? 0.6 + Math.sin(this.time * 4) * 0.4 : 0;
    ctx.fillStyle = open ? C.COLORS.exitOpen : C.COLORS.exitClosed;
    ctx.globalAlpha = open ? 0.85 + pulse * 0.15 : 0.9;
    ctx.fillRect(e.x + 4, e.y + 4, e.w - 8, e.h - 8);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = open ? '#a7f3d0' : '#9aa3b2';
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x + 4, e.y + 4, e.w - 8, e.h - 8);
    ctx.fillStyle = open ? '#06281c' : '#dbe2ec';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'KELUAR' : 'TERKUNCI', e.cx, e.cy - 3);
    if (!open) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px sans-serif';
      ctx.fillText(game.docsCollected + '/' + level.documents.length + ' dokumen', e.cx, e.cy + 14);
    }
  }

  drawDocuments(ctx, level) {
    for (const d of level.documents) {
      if (d.taken) continue;
      const bob = Math.sin(this.time * 3 + d.x) * 3;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(d.x - 8, d.y - 10 + bob, 16, 20);
      ctx.strokeStyle = C.COLORS.document;
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x - 8, d.y - 10 + bob, 16, 20);
      ctx.fillStyle = C.COLORS.document;
      ctx.fillRect(d.x - 5, d.y - 6 + bob, 10, 2);
      ctx.fillRect(d.x - 5, d.y - 1 + bob, 10, 2);
      ctx.fillRect(d.x - 5, d.y + 4 + bob, 7, 2);
    }
  }

  drawCones(ctx, game) {
    for (const g of game.guards) {
      const poly = g.conePolygon(game.level);
      let color = C.COLORS.coneCalm;
      if (g.state === 'chase') color = C.COLORS.coneChase;
      else if (g.state === 'suspicious') color = C.COLORS.coneSuspicious;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fill();
    }
    for (const cam of game.cameras) {
      const poly = cam.conePolygon(game.level);
      ctx.fillStyle = C.COLORS.coneCamera;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawGuards(ctx, game) {
    for (const g of game.guards) {
      // Badan guard: lingkaran merah/amber + arah hadap.
      ctx.fillStyle = g.state === 'chase' ? C.COLORS.guard : g.state === 'suspicious' ? C.COLORS.guardAmber : '#c2410c';
      ctx.beginPath();
      ctx.arc(g.x, g.y, C.GUARD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Topi / arah hadap.
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(g.x + Math.cos(g.angle) * 7, g.y + Math.sin(g.angle) * 7, 5, 0, Math.PI * 2);
      ctx.fill();
      // Tanda seru saat curiga, tanda kejar saat mengejar.
      if (g.state === 'suspicious' || g.state === 'chase') {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(g.state === 'chase' ? '!' : '?', g.x, g.y - 20);
      }
    }
  }

  drawCameras(ctx, game) {
    for (const cam of game.cameras) {
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(cam.x, cam.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cam.seesPlayer ? '#ef4444' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(cam.x + Math.cos(cam.angle) * 6, cam.y + Math.sin(cam.angle) * 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTakenDown(ctx, game) {
    // Guard yang di-takedown: penanda kecil di lantai.
    for (const t of game.takenDown) {
      ctx.fillStyle = '#3f3f46';
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#52525b';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#a1a1aa';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('z z', t.x, t.y - 10);
    }
  }

  drawPlayer(ctx, game) {
    const p = game.player;
    // Di dalam lemari: pemain tidak digambar (tersembunyi).
    if (p.hiddenInLocker) return;
    const r = p.radius;
    // Bayangan samar di bawah pemain.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 8, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Di semak: pemain samar (tersembunyi).
    ctx.globalAlpha = p.inBush ? 0.55 : 1;
    ctx.fillStyle = C.COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.COLORS.playerDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Arah hadap (topi kurir).
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 7, p.y + Math.sin(p.angle) * 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Indikator jongkok: cincin putus-putus.
    if (p.crouching) {
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.8)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Koin yang sedang dilempar.
    for (const th of p.throws) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(th.x, th.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  drawNoise(ctx, game) {
    const p = game.player;
    if (p.noisePulse) {
      ctx.strokeStyle = 'rgba(255, 255, 255,' + (p.noisePulse.t * 0.7).toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.noisePulse.x, p.noisePulse.y, p.noisePulse.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const f of game.noiseFlashes) {
      ctx.strokeStyle = 'rgba(255, 209, 102,' + (f.t * 0.8).toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1 - f.t * 0.3), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawDarkness(ctx, game) {
    const dctx = this.darkCtx;
    dctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = C.COLORS.darkness;
    dctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    dctx.globalCompositeOperation = 'destination-out';
    // Lubang cahaya di tiap lampion yang menyala.
    for (const l of game.level.lanterns) {
      if (l.on === false) continue;
      const grad = dctx.createRadialGradient(l.x, l.y, 10, l.x, l.y, 170);
      grad.addColorStop(0, 'rgba(0,0,0,0.95)');
      grad.addColorStop(0.6, 'rgba(0,0,0,0.55)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = grad;
      dctx.beginPath();
      dctx.arc(l.x, l.y, 170, 0, Math.PI * 2);
      dctx.fill();
    }
    // Cahaya kecil di sekitar pemain (senter redup) + exit bila terbuka.
    const p = game.player;
    const pg = dctx.createRadialGradient(p.x, p.y, 5, p.x, p.y, 115);
    pg.addColorStop(0, 'rgba(0,0,0,0.65)');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = pg;
    dctx.beginPath();
    dctx.arc(p.x, p.y, 115, 0, Math.PI * 2);
    dctx.fill();
    const e = game.level.exit;
    if (game.docsCollected >= game.level.documents.length) {
      const eg = dctx.createRadialGradient(e.cx, e.cy, 5, e.cx, e.cy, 120);
      eg.addColorStop(0, 'rgba(0,0,0,0.7)');
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = eg;
      dctx.beginPath();
      dctx.arc(e.cx, e.cy, 120, 0, Math.PI * 2);
      dctx.fill();
    }
    ctx.drawImage(this.dark, 0, 0);
  }

  drawBanner(ctx, game) {
    if (!game.bannerText || game.bannerTimer <= 0) return;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
    ctx.fillRect(340, 90, 600, 40);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(340, 90, 600, 40);
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.bannerText, 640, 117);
  }

  drawPrompts(ctx, game) {
    // Petunjuk konteks: E interaksi / F takedown.
    ctx.textAlign = 'center';
    if (game.takedownTarget) {
      const g = game.takedownTarget;
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('F — Takedown sunyi!', g.x, g.y - 26);
    } else if (game.nearInteract) {
      const n = game.nearInteract;
      let text = '';
      if (n.type === 'locker') text = 'E — Sembunyi di lemari';
      else if (n.type === 'locker-exit') text = 'E — Keluar dari lemari';
      else if (n.type === 'switch') text = n.sw.on ? 'E — Matikan lampu' : 'E — Nyalakan lampu';
      if (text) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(text, n.x, n.y - 26);
      }
    }
  }
}
