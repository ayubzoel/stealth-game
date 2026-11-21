// Lorong Senja — guards.js
// Patroli waypoint, vision cone, line-of-sight, dan state:
// patrol -> suspicious (curiga, datangi titik terakhir terlihat)
//        -> chase (kejar pemain) -> return (kembali ke patroli).

import { CONFIG } from './config.js';
import { hasLineOfSight, raycastDistance, collideCircle, lightAt } from './world.js';

const C = CONFIG;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Guard {
  constructor(x, y, waypointsPx) {
    this.x = x;
    this.y = y;
    this.waypoints = waypointsPx; // [{x, y}, ...]
    this.wpIndex = 0;
    this.angle = Math.PI / 2; // menghadap bawah
    this.state = 'patrol'; // patrol | suspicious | chase | return
    this.lastSeen = null; // { x, y }
    this.investigateTimer = 0;
    this.seesPlayer = false;
    this.pauseTimer = 0;
  }

  // Apakah pemain terlihat oleh guard ini (cone + jarak + LOS)?
  canSee(level, px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > C.CONE_RANGE) return false;
    const targetAngle = Math.atan2(dy, dx);
    const half = (C.CONE_HALF_ANGLE_DEG * Math.PI) / 180;
    if (Math.abs(angleDiff(targetAngle, this.angle)) > half && dist > 34) return false;
    return hasLineOfSight(level, this.x, this.y, px, py);
  }

  update(dt, game) {
    const level = game.level;
    const player = game.player;
    const seen = this.canSee(level, player.x, player.y);
    this.seesPlayer = seen;

    if (seen) {
      this.lastSeen = { x: player.x, y: player.y };
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      const light = lightAt(level, player.x, player.y);
      let rate = C.DETECT_RATE_DARK + (C.DETECT_RATE_LIGHT - C.DETECT_RATE_DARK) * light;
      if (dist < C.CONE_CLOSE_RANGE) rate = C.DETECT_RATE_CLOSE;
      if (player.sneaking) rate *= 0.55;
      game.detection = Math.min(100, game.detection + rate * dt);
      if (game.detection >= C.CHASE_AT && this.state !== 'chase') {
        this.state = 'chase';
        game.audio.alarm();
      } else if (game.detection >= C.SUSPICIOUS_AT && this.state === 'patrol') {
        this.state = 'suspicious';
        this.investigateTimer = 4;
        game.audio.suspicious();
      }
    }

    // Gerak sesuai state.
    if (this.state === 'chase') {
      this.moveToward(dt, level, player.x, player.y, C.GUARD_CHASE_SPEED);
      this.faceToward(player.x, player.y, dt, 10);
      if (!seen && game.detection < C.CHASE_AT) {
        this.state = 'suspicious';
        this.investigateTimer = 3;
      }
      // Tertangkap bila guard menyentuh pemain.
      if (Math.hypot(player.x - this.x, player.y - this.y) < C.GUARD_CATCH_RADIUS) {
        game.loseLevel('tertangkap');
      }
    } else if (this.state === 'suspicious' && this.lastSeen) {
      const arrived = this.moveToward(dt, level, this.lastSeen.x, this.lastSeen.y, C.GUARD_SUSPICIOUS_SPEED);
      this.faceToward(this.lastSeen.x, this.lastSeen.y, dt, 6);
      this.investigateTimer -= dt;
      if (arrived || this.investigateTimer <= 0) {
        // Lihat sekeliling sebentar, lalu kembali.
        this.pauseTimer += dt;
        if (this.pauseTimer > 1.2) {
          this.pauseTimer = 0;
          this.state = 'return';
        }
      }
    } else if (this.state === 'return') {
      const wp = this.waypoints[this.wpIndex];
      const arrived = this.moveToward(dt, level, wp.x, wp.y, C.GUARD_PATROL_SPEED);
      this.faceToward(wp.x, wp.y, dt, 6);
      if (arrived) this.state = 'patrol';
    } else {
      // patrol
      if (this.pauseTimer > 0) {
        this.pauseTimer -= dt;
      } else {
        const wp = this.waypoints[this.wpIndex];
        const arrived = this.moveToward(dt, level, wp.x, wp.y, C.GUARD_PATROL_SPEED);
        this.faceToward(wp.x, wp.y, dt, 5);
        if (arrived) {
          this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
          this.pauseTimer = 0.9; // berhenti sejenak di tiap waypoint
        }
      }
    }
  }

  // Bergerak menuju titik; true bila sudah sampai (dalam 6 px).
  moveToward(dt, level, tx, ty, speed) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) return true;
    const step = Math.min(dist, speed * dt);
    const nx = (dx / dist) * step;
    const ny = (dy / dist) * step;
    const pos = collideCircle(level, this.x, this.y, C.GUARD_RADIUS, nx, ny);
    this.x = pos.x;
    this.y = pos.y;
    return false;
  }

  faceToward(tx, ty, dt, turnRate) {
    const target = Math.atan2(ty - this.y, tx - this.x);
    const diff = angleDiff(target, this.angle);
    const maxTurn = turnRate * dt;
    this.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
  }

  // Poligon cone untuk digambar: raycast ke dinding di tiap sudut cone.
  conePolygon(level) {
    const half = (C.CONE_HALF_ANGLE_DEG * Math.PI) / 180;
    const rays = 14;
    const pts = [{ x: this.x, y: this.y }];
    for (let i = 0; i <= rays; i++) {
      const a = this.angle - half + (2 * half * i) / rays;
      const d = raycastDistance(level, this.x, this.y, a, C.CONE_RANGE);
      pts.push({ x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d });
    }
    return pts;
  }
}

// Kamera pengawas: cone statis yang berputar (menyapu).
export class Camera {
  constructor(x, y, baseAngle, sweepArc) {
    this.x = x;
    this.y = y;
    this.baseAngle = baseAngle;
    this.sweepArc = sweepArc;
    this.angle = baseAngle - sweepArc / 2;
    this.time = 0;
    this.seesPlayer = false;
  }

  update(dt, game) {
    this.time += dt;
    this.angle = this.baseAngle + Math.sin(this.time * C.CAMERA_SWEEP_SPEED) * this.sweepArc;
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const half = (C.CAMERA_HALF_ANGLE_DEG * Math.PI) / 180;
    const seen =
      dist < C.CAMERA_RANGE &&
      Math.abs(angleDiff(Math.atan2(dy, dx), this.angle)) < half &&
      hasLineOfSight(game.level, this.x, this.y, player.x, player.y);
    this.seesPlayer = seen;
    if (seen) {
      game.detection = Math.min(100, game.detection + C.CAMERA_DETECT_RATE * dt);
      if (game.detection >= C.CHASE_AT) {
        for (const g of game.guards) {
          if (g.state === 'patrol') {
            g.state = 'suspicious';
            g.lastSeen = { x: player.x, y: player.y };
            g.investigateTimer = 4;
          }
        }
      }
    }
  }

  conePolygon(level) {
    const half = (C.CAMERA_HALF_ANGLE_DEG * Math.PI) / 180;
    const rays = 10;
    const pts = [{ x: this.x, y: this.y }];
    for (let i = 0; i <= rays; i++) {
      const a = this.angle - half + (2 * half * i) / rays;
      const d = raycastDistance(level, this.x, this.y, a, C.CAMERA_RANGE);
      pts.push({ x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d });
    }
    return pts;
  }
}

// Bangun guard dari definisi level (spawn + waypoint tile -> px).
export function buildGuards(level) {
  return level.guardSpawns.map((spawn, i) => {
    const wps = (level.waypoints[i] || [[1, 1]]).map(([tx, ty]) => ({
      x: tx * CONFIG.TILE + CONFIG.TILE / 2,
      y: ty * CONFIG.TILE + CONFIG.TILE / 2,
    }));
    return new Guard(spawn.x, spawn.y, wps);
  });
}

export function buildCameras(level) {
  return (level.cameras || []).map((c) => new Camera(c.x, c.y, c.baseAngle, c.sweepArc));
}
